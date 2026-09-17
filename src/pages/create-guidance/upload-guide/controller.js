import { statusCodes } from '../../../constants/status-codes.js'
import { RESULTS, startMigration, getGuideUploadProgress } from '../service.js'
import { getGuideUpload, createGuideUpload, addGuideUpload } from '../session.js'
import { UploadGuidanceViewModel } from './view-models.js'

const UPLOAD_GUIDANCE_VIEW = 'create-guidance/upload-guide/page.njk'
const PROCESSING_URL = '/create-guidance/upload-guide/processing'
const METADATA_URL = '/create-guidance/upload-guide/metadata'

/**
 * Render the upload form for a guide migration, initiating one if none has
 * been started yet (or the last one failed). An upload still being scanned
 * sends the user back to the processing page; one where every step, including
 * minimal-parse, has completed sends them on to add metadata.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getUploadForm (request, h) {
  const upload = getGuideUpload(request) ?? createGuideUpload(request)
  const result = await startMigration(upload)

  if (result.code === RESULTS.UPLOAD_PENDING) {
    return h.redirect(PROCESSING_URL)
  }

  if (result.code === RESULTS.UPLOAD_COMPLETE) {
    const progress = await getGuideUploadProgress(request)

    if (!progress.isComplete) {
      return h.redirect(PROCESSING_URL)
    }

    request.yar.flash('uploadNotification', 'You have already uploaded a document for this guide')

    return h.redirect(METADATA_URL)
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
