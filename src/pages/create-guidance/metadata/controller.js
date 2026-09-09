import { statusCodes } from '../../../constants/status-codes.js'
import { captureGuide } from '../service.js'
import { getGuideUpload } from '../session.js'
import { MigrateMetadataViewModel } from './view-models.js'

const MIGRATE_METADATA_VIEW = 'create-guidance/metadata/page.njk'

async function getMetadataForm (request, h) {
  const saved = request.yar.get('guidance')

  const [notification] = request.yar.flash('uploadNotification')

  const viewModel = MigrateMetadataViewModel.fromSession(notification, saved?.metadata)

  return h
    .view(MIGRATE_METADATA_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

async function addMetadataFailAction (request, h, err) {
  const viewModel = MigrateMetadataViewModel.fromValidationError(request.payload, err)

  return h
    .view(MIGRATE_METADATA_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
    .takeover()
}

async function addMetadata (request, h) {
  request.yar.set('guidance', {
    metadata: request.payload
  })

  // Read before the session is cleared: the upload id is the only handle on the
  // document that was uploaded, and resetting first would throw it away.
  const uploadId = getGuideUpload(request)?.activeUploadId

  if (!uploadId) {
    request.logger.warn('Metadata submitted with no upload in session')

    return h.redirect('/create-guidance/upload-guide')
  }

  try {
    const guide = await captureGuide(uploadId, request.payload, request.auth?.credentials?.id)

    request.logger.info({ guideId: guide.id }, 'Captured guide')
  } catch (error) {
    // The document is uploaded and the metadata is in session, so the journey can
    // be retried without repeating either. Sending the same upload again answers
    // the guide it already made rather than converting a second time.
    request.logger.error({ error }, 'Failed to capture guide')

    return h
      .view(
        MIGRATE_METADATA_VIEW,
        MigrateMetadataViewModel.fromSubmissionError(
          request.payload,
          'The guidance could not be saved. Try again.'
        )
      )
      .code(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)
  }

  request.yar.reset()

  return h.redirect('/designer/dashboard')
}

export {
  getMetadataForm,
  addMetadata,
  addMetadataFailAction
}
