import { statusCodes } from '../../../../constants/status-codes.js'
import { getGuideUpload } from '../../session.js'
import {
  checkUploadHandleStatus,
  getGuideUploadProgress,
  RESULTS
} from '../../service.js'
import { UploadProcessingViewModel } from './view-models.js'

const PROCESSING_VIEW = 'create-guidance/upload-guide/processing/page.njk'

/**
 * Render the "Checking your file" page while an upload is being processed.
 *
 * Redirects back to upload form if no upload exists, or to upload-guide if the
 * upload hasn't progressed yet (still in 'initiated' state).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getStatusPage (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect('/create-guidance/upload-guide')
  }

  const uploadId = upload.activeUploadId
  const handleStatus = await checkUploadHandleStatus(request)

  if (handleStatus.code === RESULTS.UPLOAD_AVAILABLE) {
    return h.redirect('/create-guidance/upload-guide')
  }

  const progress = await getGuideUploadProgress(request, uploadId)

  const viewModel = new UploadProcessingViewModel({ uploadId, ...progress })

  return h.view(PROCESSING_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getStatusPage
}
