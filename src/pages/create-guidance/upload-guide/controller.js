import { statusCodes } from '../../../constants/status-codes.js'
import { RESULTS, startMigration } from '../service.js'
import { getGuideUpload, createGuideUpload, addGuideUpload } from '../session.js'
import { UploadGuidanceViewModel } from './view-models.js'

const UPLOAD_GUIDANCE_VIEW = 'create-guidance/upload-guide/page.njk'

/**
 * Render the upload form for a guide migration, initiating one if none has
 * been started yet. If an upload has already been completed, the user is
 * redirected to add metadata.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getUploadForm (request, h) {
  const upload = getGuideUpload(request) ?? createGuideUpload(request)
  const result = await startMigration(upload)

  if (result.code === RESULTS.UPLOAD_EXPENDED) {
    request.yar.flash('uploadNotification', 'You have already uploaded a document for this guide')

    return h.redirect('/create-guidance/metadata')
  }

  if (result.code === RESULTS.MIGRATION_STARTED) {
    addGuideUpload(request, result.uploadId)
  }

  const uploadId = result.uploadId ?? upload.activeUploadId

  const viewModel = new UploadGuidanceViewModel({ uploadId })

  return h.view(UPLOAD_GUIDANCE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getUploadForm
}
