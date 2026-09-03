import { statusCodes } from '../../../constants/status-codes.js'
import { getUploadStatus } from '../../../services/uploader.js'
import { RESULTS, startMigration } from '../service.js'
import { getGuideUpload, createGuideUpload, addGuideUpload } from '../session.js'
import { UploadGuidanceViewModel, UploadStatusViewModel } from './view-models.js'

const UPLOAD_GUIDANCE_VIEW = 'create-guidance/upload-guide/page.njk'
const UPLOAD_STATUS_VIEW = 'create-guidance/upload-guide/status.njk'

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

/**
 * Render the upload status page. If upload is complete and clean, redirects
 * to metadata. If in progress, renders status view with auto-refresh.
 * If rejected, renders error view.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getUploadStatusPage (request, h) {
  const upload = getGuideUpload(request)

  if (!upload || !upload.hasUpload()) {
    return h.redirect('/create-guidance/upload-guide')
  }

  const uploadId = upload.activeUploadId
  const status = await getUploadStatus(uploadId)

  if (!status) {
    const viewModel = new UploadStatusViewModel({
      uploadId,
      errorMessage: 'Upload details could not be found'
    })

    return h.view(UPLOAD_STATUS_VIEW, viewModel)
      .code(statusCodes.HTTP_STATUS_NOT_FOUND)
  }

  if (status.isReady && !status.hasRejectedFiles) {
    return h.redirect('/create-guidance/metadata')
  }

  const viewModel = new UploadStatusViewModel({
    uploadId,
    uploadStatus: status.uploadStatus,
    isReady: status.isReady,
    hasRejectedFiles: status.hasRejectedFiles,
    files: status.files
  })

  return h.view(UPLOAD_STATUS_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getUploadForm,
  getUploadStatusPage
}
