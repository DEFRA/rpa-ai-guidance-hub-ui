import { config } from '../../config/config.js'

import * as session from './session.js'
import * as steps from './upload-guide/steps.js'

import { getUploadStatus, initiateUpload } from '../../services/uploader.js'
import { ProgressTracker } from '../../services/progress-tracker.js'

/**
 * Result codes returned by guide upload and migration helpers
 *
 * @readonly
 * @enum {string}
 */
const RESULTS = {
  MIGRATION_STARTED: 'migrationStarted',
  NO_UPLOAD: 'noUpload',
  UPLOAD_AVAILABLE: 'uploadAvailable', // initiated - the upload form can still be used
  UPLOAD_PENDING: 'uploadPending', // file received, scan in progress
  UPLOAD_COMPLETE: 'uploadComplete', // scanned clean and delivered
  UPLOAD_FAILED: 'uploadFailed' // rejected, empty, or unknown to cdp-uploader
}

/**
 * Upload progress steps mapped onto ProgressTracker.
 *
 * Steps only define pending/failed statuses; completion is handled by the
 * overall flow status. A check may return a `failure` naming a more specific
 * failed status and message.
 *
 * @type {Array<{id: string, pendingStatusId: string, failedStatusId: string, check: Function}>}
 */
const STEP_CHECKS = [
  {
    id: steps.STEP_IDS.SCANNING,
    pendingStatusId: steps.STATUS_IDS.UPLOADER_PENDING,
    failedStatusId: steps.STATUS_IDS.UPLOADER_FAILED,
    check: _checkScanningStatus
  }
]

const STEP_CHECKS_BY_ID = Object.fromEntries(STEP_CHECKS.map((stepCheck) => [stepCheck.id, stepCheck]))

/**
 * StatusId reported once every step has completed.
 *
 * @type {string}
 */
const FINAL_STATUS_ID = steps.STATUS_IDS.UPLOADER_COMPLETE

/**
 * Single tracker instance for the guide upload domain. Holds only the static
 * step config, so it's safe to build once and reuse across every request —
 * no per-request state lives on the instance.
 */
const tracker = new ProgressTracker(STEP_CHECKS)

/**
 * Ensure a migration/upload flow is started for the provided session wrapper.
 *
 * Reuses an upload whose form has not been submitted yet, reports one that
 * is in progress or complete, and starts a fresh upload when there is none
 * or the last one failed (rejected, empty or no longer known to cdp-uploader).
 *
 * @param {import('./session.js').GuideUpload} upload - The GuideUpload instance from session
 * @returns {Promise<{code: string, uploadId?: string}>}
 */
async function startMigration (upload) {
  if (upload.hasUpload()) {
    const status = await getUploadStatus(upload.activeUploadId)
    const { code } = _evaluateUploadStatus(status)

    if (code !== RESULTS.UPLOAD_FAILED) {
      return { code }
    }
  }

  const uploadId = await _initiateGuideUpload()

  return {
    code: RESULTS.MIGRATION_STARTED,
    uploadId
  }
}

/**
 * Report where the session's active upload has got to with cdp-uploader.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<{code: string, failure?: {statusId: string, message?: string}, status?: import('../../services/uploader.js').UploadStatusModel|null}>}
 *   `status` is the cdp-uploader status just fetched, so callers can hand it
 *   to `getGuideUploadProgress` rather than fetching it twice.
 */
async function getUploadOutcome (request) {
  const upload = session.getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return { code: RESULTS.NO_UPLOAD }
  }

  const status = await getUploadStatus(upload.activeUploadId)

  return { ..._evaluateUploadStatus(status), status }
}

/**
 * Get current progress for the session's active upload, checking downstream
 * systems as needed.
 *
 * Skips re-checks of steps already confirmed complete (cached in session) to
 * avoid unnecessary API calls.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {{status?: Object|null}} [options] - A cdp-uploader status already
 *   fetched for this upload, to save the scanning check fetching it again
 * @returns {Promise<{statusId: string, label: string, percentage: number, isComplete: boolean, isError: boolean, message: string|null}>}
 */
async function getGuideUploadProgress (request, options = {}) {
  const upload = session.getGuideUpload(request)
  const completedStepIds = upload?.completedStepIds ?? []
  const context = { uploadId: upload?.activeUploadId ?? null, status: options.status }

  const trackerStatus = await tracker.getStatus(context, completedStepIds)

  if (trackerStatus.completedStepIds.length !== completedStepIds.length) {
    session.setGuideUploadCompletedSteps(request, trackerStatus.completedStepIds)
  }

  const statusId = _resolveStatusId(trackerStatus)
  const stepState = steps.getStepState(statusId)

  return {
    statusId,
    label: stepState.label,
    percentage: stepState.percentage,
    isComplete: trackerStatus.isComplete,
    isError: trackerStatus.isError,
    message: trackerStatus.failure?.message ?? stepState.message ?? null
  }
}

/**
 * Resolve the namespaced statusId for a tracker result, using the declarative
 * STEP_CHECKS config rather than hardcoded conditionals per step.
 *
 * @private
 * @param {{stepId: string, isComplete: boolean, isError: boolean, failure?: {statusId?: string}}} trackerStatus
 * @returns {string}
 */
function _resolveStatusId (trackerStatus) {
  if (trackerStatus.isComplete) {
    return FINAL_STATUS_ID
  }

  const stepCheck = STEP_CHECKS_BY_ID[trackerStatus.stepId]

  if (!trackerStatus.isError) {
    return stepCheck.pendingStatusId
  }

  return trackerStatus.failure?.statusId ?? stepCheck.failedStatusId
}

/**
 * @private
 * Initiate a new guide upload via the CDP uploader and return the uploadId.
 *
 * @returns {Promise<string>} The initiated upload id
 */
async function _initiateGuideUpload () {
  const initiateRequest = {
    redirect: '/create-guidance/upload-guide/processing',
    s3Bucket: config.get('cdpUploader.sourceDocsBucket')
  }

  const { uploadId } = await initiateUpload(initiateRequest)

  return uploadId
}

/**
 * @private
 * Classify a cdp-uploader status for this journey, which expects exactly one
 * clean file.
 *
 * cdp-uploader marks an upload `ready` with no files when the form was
 * submitted empty, and forgets uploads after a while (404, projected as
 * null) - both are failures here, not successes.
 *
 * @param {import('../../services/uploader.js').UploadStatusModel|null} status
 * @returns {{code: string, failure?: {statusId: string, message?: string}}}
 */
function _evaluateUploadStatus (status) {
  if (!status) {
    return _failed(steps.STATUS_IDS.UPLOADER_MISSING)
  }

  if (status.uploadStatus === 'initiated') {
    return { code: RESULTS.UPLOAD_AVAILABLE }
  }

  if (!status.isReady) {
    return { code: RESULTS.UPLOAD_PENDING }
  }

  const [file] = status.files

  if (!file) {
    return _failed(steps.STATUS_IDS.UPLOADER_NO_FILE)
  }

  if (status.hasRejectedFiles) {
    return _failed(steps.STATUS_IDS.UPLOADER_REJECTED, file.error?.message)
  }

  return { code: RESULTS.UPLOAD_COMPLETE }
}

/**
 * @private
 * @param {string} statusId
 * @param {string} [message] - User-facing reason, when the source supplies one
 * @returns {{code: string, failure: {statusId: string, message?: string}}}
 */
function _failed (statusId, message) {
  return {
    code: RESULTS.UPLOAD_FAILED,
    failure: { statusId, message }
  }
}

/**
 * Check scanning/virus-check status via uploader
 *
 * @private
 * @param {{uploadId: string|null, status?: Object|null}} context - The upload
 *   to check, and optionally its already-fetched cdp-uploader status (null
 *   meaning cdp-uploader returned 404, so not refetched)
 * @returns {Promise<{complete: boolean, error?: boolean, failure?: {statusId: string, message?: string}}>}
 */
async function _checkScanningStatus ({ uploadId, status: knownStatus }) {
  try {
    const status = knownStatus === undefined
      ? await getUploadStatus(uploadId)
      : knownStatus
    const { code, failure } = _evaluateUploadStatus(status)

    if (code === RESULTS.UPLOAD_COMPLETE) {
      return { complete: true }
    }

    if (code === RESULTS.UPLOAD_FAILED) {
      return { complete: false, error: true, failure }
    }

    return { complete: false }
  } catch {
    return { complete: false, error: true }
  }
}

export {
  RESULTS,
  getUploadOutcome,
  getGuideUploadProgress,
  startMigration
}
