import { statusCodes } from '../constants/status-codes.js'
import * as uploaderApi from '../infra/cdp-uploader/uploads.js'

/**
 * Projected file model - only what callers actually use, with the
 * location and error fields folded together since they're only ever
 * read as a pair.
 *
 * @typedef {Object} UploadFileModel
 * @property {string} field - The form field this file came from
 * @property {string} [filename]
 * @property {string} [contentType]
 * @property {string} fileStatus - 'complete' | 'rejected' | 'pending'
 * @property {string} [location] - S3 location of the uploaded file, e.g., 's3://bucket/key'
 * @property {{code: string, message: string}} [error] - Present only when the file was rejected
 */

/**
 * Projected upload status model exposed to application code.
 *
 * @typedef {Object} UploadStatusModel
 * @property {string} uploadStatus - e.g. 'initiated' | 'pending' | 'ready'
 * @property {boolean} isReady
 * @property {Object<string, string>} [metadata] - Round-tripped from initiate
 * @property {Object<string, string>} formFields - Non-file form values, keyed by field name
 * @property {UploadFileModel[]} files
 * @property {boolean} hasRejectedFiles
 */

/**
 * Start an upload and get back the URLs the caller needs.
 *
 * @param {Object} initiateRequest - See uploads.js InitiateRequest
 * @returns {Promise<{uploadId: string, uploadUrl?: string, statusUrl: string}>}
 * @throws {CdpUploaderError} - If initiate fails with unexpected status
 */
async function initiateUpload (initiateRequest) {
  const res = await uploaderApi.initiateUpload(initiateRequest)

  if (res.ok) {
    const {
      uploadId,
      uploadUrl,
      statusUrl
    } = res.data

    return {
      uploadId,
      uploadUrl,
      statusUrl
    }
  }

  throw _unexpectedStatus(res.status)
}

/**
 * @private
 * Build the error thrown when the cdp-uploader API returns a status this
 * service doesn't otherwise handle.
 *
 * @param {number} status
 * @returns {Error & {statusCode: number}}
 */
function _unexpectedStatus (status) {
  const error = new Error(`Unexpected status ${status} from cdp-uploader initiate`)
  error.statusCode = status

  return error
}

/**
 * Get the status of an upload by its ID.
 *
 * @param {string} uploadId
 * @param {{debug?: boolean}} [options]
 * @returns {Promise<UploadStatusModel|null>} Shaped status, or null if uploadId is not found
 */
async function getUploadStatus (uploadId, options = {}) {
  const res = await uploaderApi.getUploadStatus(uploadId, options)

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return null
  }

  return _projectUploadStatus(res.data)
}

/**
 * Project the raw cdp-uploader response into the UploadStatusModel.
 *
 * @param {Object} raw - The raw res.data from the status endpoint
 * @returns {UploadStatusModel}
 */
function _projectUploadStatus (raw) {
  const { uploadStatus, form = {}, metadata, numberOfRejectedFiles } = raw

  const formFields = {}
  const files = []

  for (const [field, value] of Object.entries(form)) {
    const isFileValue = Boolean(value) && typeof value === 'object'

    if (!isFileValue) {
      formFields[field] = value
      continue
    }

    const fileEntries = Array.isArray(value) ? value : [value]
    files.push(...fileEntries.map((file) => _projectFile(field, file)))
  }

  return {
    uploadStatus,
    isReady: uploadStatus === 'ready',
    metadata,
    formFields,
    files,
    hasRejectedFiles: Boolean(numberOfRejectedFiles)
  }
}

/**
 * @private
 * Project a raw file object from the form into the UploadFileModel.
 *
 * @param {string} field - The form field name this file belongs to
 * @param {Object} file - The raw file object from the form
 * @returns {UploadFileModel} The structured file model
 */
function _projectFile (field, file) {
  const projected = {
    field,
    filename: file.filename,
    contentType: file.contentType,
    fileStatus: file.fileStatus
  }

  if (file.s3Key) {
    projected.location = `s3://${file.s3Bucket}/${file.s3Key}`
  }

  if (file.hasError) {
    projected.error = {
      code: file.errorCode,
      message: file.errorMessage
    }
  }

  return projected
}

export {
  initiateUpload,
  getUploadStatus
}
