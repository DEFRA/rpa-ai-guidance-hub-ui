import { statusCodes } from '../../../constants/status-codes.js'
import { RESULTS, checkUploadSession } from '../service.js'
import { getGuideUpload } from '../session.js'
import { UploadGuidanceViewModel } from './view-models.js'

const UPLOAD_GUIDANCE_VIEW = 'create-guidance/upload-guide/page.njk'

/**
 * Render the upload form for a guide migration. If no migration has been
 * started the user is redirected to the action-type page. If an upload has
 * already been completed, the user is redirected to add metadata.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getUploadForm (request, h) {
  const upload = getGuideUpload(request)
  const result = await checkUploadSession(upload)

  if (result.code === RESULTS.NO_MIGRATION) {
    request.yar.flash('uploadNotification', 'No guide migration has been started')

    return h.redirect('/create-guidance/action-type')
  }

  if (result.code === RESULTS.UPLOAD_EXPENDED) {
    request.yar.flash('uploadNotification', 'You have already uploaded a document for this guide')

    return h.redirect('/create-guidance/metadata')
  }

  const viewModel = new UploadGuidanceViewModel({
    uploadId: upload.activeUploadId
  })

  return h.view(UPLOAD_GUIDANCE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getUploadForm
}
