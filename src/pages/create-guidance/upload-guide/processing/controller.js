import { statusCodes } from '../../../../constants/status-codes.js'
import { getGuideUpload } from '../../session.js'
import {
  getGuideUploadProgress,
  getUploadOutcome,
  RESULTS
} from '../../service.js'
import { UploadProcessingViewModel } from './view-models.js'

const PROCESSING_VIEW = 'create-guidance/upload-guide/processing/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'

/**
 * Render the "Checking your file" page while an upload is being processed.
 *
 * Sends the user back to the upload form when there is nothing to check yet,
 * and straight on to metadata when the file has already been scanned clean,
 * so neither depends on client-side JavaScript.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getStatusPage (request, h) {
  const outcome = await getUploadOutcome(request)

  if (outcome.code === RESULTS.NO_UPLOAD || outcome.code === RESULTS.UPLOAD_AVAILABLE) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  if (outcome.code === RESULTS.UPLOAD_COMPLETE) {
    return h.redirect(METADATA_URL)
  }

  const progress = await getGuideUploadProgress(request, { status: outcome.status })

  const viewModel = new UploadProcessingViewModel(progress)

  return h.view(PROCESSING_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * JSON progress for the session's active upload, polled by the processing
 * page. The upload is always the one in the caller's session - never one
 * named by the client.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getStatus (request, h) {
  if (!getGuideUpload(request)?.hasUpload()) {
    return h.response({ message: 'No active upload found' })
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  const progress = await getGuideUploadProgress(request)

  return h.response({
    percentage: progress.percentage,
    label: progress.label,
    message: progress.message,
    isComplete: progress.isComplete,
    isError: progress.isError
  }).code(statusCodes.HTTP_STATUS_OK)
}

export {
  getStatusPage,
  getStatus
}
