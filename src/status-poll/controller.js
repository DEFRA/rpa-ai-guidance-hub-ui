import { statusCodes } from '../constants/status-codes.js'
import { getGuideUpload } from '../pages/create-guidance/session.js'
import { getUploadStatus } from '../services/uploader.js'

/**
 * Controller for retrieving upload status for polling
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getStatus (request, h) {
  const uploadId = request.params.uploadId ||
    request.query?.uploadId ||
    getGuideUpload(request)?.activeUploadId

  if (!uploadId) {
    return h.response({ message: 'No active upload found' })
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  const status = await getUploadStatus(uploadId)

  if (!status) {
    return h.response({ message: 'Upload not found' })
      .code(statusCodes.HTTP_STATUS_NOT_FOUND)
  }

  const redirectUrl = status.isReady && !status.hasRejectedFiles
    ? '/create-guidance/metadata'
    : null

  return h.response({
    uploadId,
    uploadStatus: status.uploadStatus,
    isReady: status.isReady,
    hasRejectedFiles: status.hasRejectedFiles,
    files: status.files,
    redirectUrl
  }).code(statusCodes.HTTP_STATUS_OK)
}

export {
  getStatus
}
