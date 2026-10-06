import { statusCodes } from '../../../../constants/status-codes.js'
import { getGuideUpload } from '../../session.js'
import { ConvertingViewModel } from './view-models.js'

const CONVERTING_VIEW = 'create-guidance/upload-guide/converting/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'

/**
 * Shown when the guidance API took longer to convert the upload than the
 * UI waits. The API carries on converting regardless, so the user is
 * offered a way to check again rather than an error.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getConverting (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  return h
    .view(CONVERTING_VIEW, new ConvertingViewModel())
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getConverting
}
