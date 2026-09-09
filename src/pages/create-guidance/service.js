import { config } from './../../config/config.js'

import * as session from './session.js'
import * as steps from './upload-guide/steps.js'

import { getUploadStatus, initiateUpload } from '../../services/uploader.js'
import { createGuide } from '../../infra/guidance-api/guides.js'
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
  UPLOAD_AVAILABLE: 'uploadAvailable',
  UPLOAD_EXPENDED: 'uploadExpended'
}

/**
 * Upload progress steps mapped onto ProgressTracker.
 *
 * 'initial' is a synthetic first status shown once before real checks run.
 * Steps only define pending/failed statuses; completion is handled by the
 * overall flow status.
 *
 * @type {Array<{id: string, pendingStatusId: string, failedStatusId: string, check: Function}>}
 */
const STEP_CHECKS = [
  {
    id: steps.STEP_IDS.INITIAL,
    pendingStatusId: steps.STATUS_IDS.INITIAL,
    failedStatusId: steps.STATUS_IDS.INITIAL,
    check: async function () {
      return { complete: false }
    }
  },
  {
    id: steps.STEP_IDS.SCANNING,
    pendingStatusId: steps.STATUS_IDS.UPLOADER_PENDING,
    failedStatusId: steps.STATUS_IDS.UPLOADER_FAILED,
    check: async function (uploadId) {
      return _checkScanningStatus(uploadId)
    }
  }
]

const STEP_CHECKS_BY_ID = {}

for (const stepCheck of STEP_CHECKS) {
  STEP_CHECKS_BY_ID[stepCheck.id] = stepCheck
}

/**
 * StatusId reported once every step has completed.

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
 * If none exists, initiate a new upload and return the started code + id.
 *
 * @param {Object} upload - The GuideUpload instance from session
 * @returns {Promise<{code: string, uploadId?: string}>}
 */
async function startMigration (upload) {
  if (!upload.hasUpload()) {
    const uploadId = await _initiateGuideUpload()

    return {
      code: RESULTS.MIGRATION_STARTED,
      uploadId
    }
  }

  const status = await getUploadStatus(upload.activeUploadId)

  if (!status) {
    throw new Error('Failed to retrieve upload status')
  }

  if (status.uploadStatus === 'initiated') {
    return { code: RESULTS.UPLOAD_AVAILABLE }
  }

  return { code: RESULTS.UPLOAD_EXPENDED }
}

/**
 * Check whether an upload handle has been used (has progressed beyond 'initiated').
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<{code: string}>} - NO_UPLOAD | UPLOAD_AVAILABLE | UPLOAD_EXPENDED
 */
async function checkUploadHandleStatus (request) {
  const upload = session.getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return { code: RESULTS.NO_UPLOAD }
  }

  const uploadId = upload.activeUploadId
  const status = await getUploadStatus(uploadId)

  if (!status) {
    return { code: RESULTS.UPLOAD_EXPENDED }
  }

  if (status.uploadStatus === 'initiated') {
    return { code: RESULTS.UPLOAD_AVAILABLE }
  }

  return { code: RESULTS.UPLOAD_EXPENDED }
}

/**
 * Get current progress for a guide upload, checking downstream systems as needed.
 *
 * Skips re-checks of steps already confirmed complete (cached in session) to
 * avoid unnecessary API calls.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} uploadId
 * @returns {Promise<{statusId: string, label: string, percentage: number, isComplete: boolean, isError: boolean}>}
 */
async function getGuideUploadProgress (request, uploadId) {
  const upload = session.getGuideUpload(request)
  const completedStepIds = upload?.completedStepIds ?? []

  const trackerStatus = await tracker.getStatus(uploadId, completedStepIds)

  const nextCompletedStepIds = trackerStatus.stepId === steps.STEP_IDS.INITIAL && !trackerStatus.isComplete
    ? [...trackerStatus.completedStepIds, steps.STEP_IDS.INITIAL]
    : trackerStatus.completedStepIds

  if (nextCompletedStepIds.length !== completedStepIds.length) {
    session.setGuideUploadCompletedSteps(request, nextCompletedStepIds)
  }

  const statusId = _resolveStatusId(trackerStatus)
  const stepState = steps.getStepState(statusId)

  return {
    statusId,
    label: stepState.label,
    percentage: stepState.percentage,
    isComplete: trackerStatus.isComplete,
    isError: trackerStatus.isError
  }
}

/**
 * Resolve the namespaced statusId for a tracker result, using the declarative
 * STEP_CHECKS config rather than hardcoded conditionals per step.
 *
 * @private
 * @param {{stepId: string, isComplete: boolean, isError: boolean}} trackerStatus
 * @returns {string}
 */
function _resolveStatusId (trackerStatus) {
  if (trackerStatus.isComplete) {
    return FINAL_STATUS_ID
  }

  const stepCheck = STEP_CHECKS_BY_ID[trackerStatus.stepId]

  return trackerStatus.isError
    ? stepCheck.failedStatusId
    : stepCheck.pendingStatusId
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
 * Check scanning/virus-check status via uploader
 *
 * @private
 * @param {string} uploadId
 * @returns {Promise<{complete: boolean, error?: boolean}>}
 */
async function _checkScanningStatus (uploadId) {
  try {
    const status = await getUploadStatus(uploadId)

    if (!status) {
      return { complete: false, error: true }
    }

    const { isReady, hasRejectedFiles } = status

    if (isReady && !hasRejectedFiles) {
      return { complete: true }
    }

    if (isReady && hasRejectedFiles) {
      return { complete: false, error: true }
    }

    return { complete: false }
  } catch {
    return { complete: false, error: true }
  }
}

/**
 * Capture the uploaded document and what its author said about it as one guide.
 *
 * The end of the journey, and the only place the two halves are both in hand: the
 * upload knows where the document went and the form says what it is. The API is
 * given where the document is rather than the id of the upload, because
 * cdp-uploader's status reports the location and this is the only thing that can
 * read it.
 *
 * Sending the same upload twice answers the guide it made the first time, so a
 * resubmitted form is safe.
 *
 * @param {string} uploadId - The upload the document arrived under
 * @param {Object<string, any>} metadata - The validated form fields
 * @param {string} [createdBy] - Who submitted it
 * @returns {Promise<{id: string, content: string, assets: string}>}
 * @throws {Error} - If the upload holds no delivered file
 * @throws {GuidanceApiError} - If the API refuses or fails
 */
async function captureGuide (uploadId, metadata, createdBy) {
  const status = await getUploadStatus(uploadId)
  const file = status?.files?.find((candidate) => candidate.location)

  if (!file) {
    throw new Error(`Upload ${uploadId} has no delivered file to convert`)
  }

  const { data } = await createGuide({
    source: {
      uploadId,
      url: file.location,
      filename: file.filename
    },
    metadata,
    createdBy
  })

  return data
}

export {
  RESULTS,
  captureGuide,
  checkUploadHandleStatus,
  getGuideUploadProgress,
  startMigration
}
