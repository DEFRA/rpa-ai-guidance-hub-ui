import { statusCodes } from '../constants/status-codes.js'
import { getGuideUpload } from '../pages/create-guidance/session.js'
import { getGuideUploadProgress } from '../pages/create-guidance/service.js'

/**
 * Controller for retrieving upload progress for polling.
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getStatus (request, h) {
  const uploadId = request.params.uploadId ??
    request.query?.uploadId ??
    getGuideUpload(request)?.activeUploadId

  if (!uploadId) {
    return h.response({ message: 'No active upload found' })
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  const progress = await getGuideUploadProgress(request, uploadId)

  return h.response({
    percentage: progress.percentage,
    label: progress.label,
    isComplete: progress.isComplete,
    isError: progress.isError
  }).code(statusCodes.HTTP_STATUS_OK)
}

export {
  getStatus
}
