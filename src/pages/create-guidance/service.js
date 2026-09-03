import { config } from './../../config/config.js'

import { getUploadStatus, initiateUpload } from '../../services/uploader.js'

/**
 * Result codes returned by migration helpers
 * @readonly
 * @enum {string}
 */
const RESULTS = {
  NO_MIGRATION: 'noMigrationStarted',
  MIGRATION_STARTED: 'migrationStarted',
  UPLOAD_AVAILABLE: 'uploadAvailable',
  UPLOAD_EXPENDED: 'uploadExpended'
}

/**
 * @private
 * Initiate a new guide upload via the CDP uploader and return the uploadId.
 *
 * @returns {Promise<string>} The initiated upload id
 */
async function _initiateGuideUpload () {
  const initiateRequest = {
    redirect: '/create-guidance/metadata',
    s3Bucket: config.get('cdpUploader.sourceDocsBucket')
  }

  const { uploadId } = await initiateUpload(initiateRequest)

  return uploadId
}

/**
 * Check the given GuideUpload session wrapper and return a result code
 * describing whether a migration/upload has been started and its state.
 *
 * @param {Object|null} upload - The GuideUpload instance from session (or null)
 * @returns {Promise<{code: string}>} Result code describing the upload state
 */
async function checkUploadSession (upload) {
  if (!upload?.hasUpload()) {
    return {
      code: RESULTS.NO_MIGRATION
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

export {
  RESULTS,
  checkUploadSession,
  startMigration
}
