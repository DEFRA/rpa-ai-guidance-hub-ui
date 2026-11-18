import { statusCodes } from '../../../../constants/status-codes.js'
import { clearGuideUpload, flashConvertedGuide, getGuideUpload } from '../../session.js'
import { getConversionProgress } from './progress.js'
import { ConvertingViewModel } from './view-models.js'

const CONVERTING_VIEW = 'create-guidance/upload-guide/converting/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const CONVERTED_URL = '/create-guidance/upload-guide/converted'

/**
 * Follow the save of the converted document. Once it is complete, the
 * upload is now a guide: the next guide starts with a new upload, and the
 * user is shown the guide they converted.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getConvertingPage (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const progress = await getConversionProgress(upload.fileId)

  if (progress.isComplete) {
    clearGuideUpload(request)
    flashConvertedGuide(request, upload.metadata?.guideTitle)

    return h.redirect(CONVERTED_URL)
  }

  return h
    .view(CONVERTING_VIEW, new ConvertingViewModel(progress))
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * JSON progress of the save for the session's upload, polled by the
 * converting page. The upload is always the one in the caller's session -
 * never one named by the client.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getConvertingStatus (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.response({ message: 'No active upload found' })
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  const progress = await getConversionProgress(upload.fileId)

  return h.response({
    percentage: progress.percentage,
    label: progress.label,
    message: progress.message,
    detail: progress.detail,
    isComplete: progress.isComplete,
    isError: progress.isError
  }).code(statusCodes.HTTP_STATUS_OK)
}

export {
  getConvertingPage,
  getConvertingStatus
}
