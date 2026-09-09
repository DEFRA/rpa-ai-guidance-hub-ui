import { statusCodes } from '../../../constants/status-codes.js'
import { captureGuide } from '../service.js'
import { getGuideUpload } from '../session.js'
import { MigrateMetadataViewModel } from './view-models.js'

const MIGRATE_METADATA_VIEW = 'create-guidance/metadata/page.njk'

/**
 * Who is signed in, as the API records the creator of a version.
 *
 * `profile.id` is the identifier the auth provider minted - Entra's object id, and
 * `dev-user-123` under local auth - and is the only field here that survives someone
 * being renamed or changing their email, which is why it and not the display name is
 * what anything matches on. The display name travels with it so that a listing can
 * say who made a version without asking a directory.
 *
 * This is *not* who owns the document. Owners are metadata an author supplies, may
 * be a team rather than a person, and are not derived from who pressed the button.
 *
 * @param {object} request
 * @returns {{ id: string, displayName: string | undefined } | undefined}
 */
function signedInUser (request) {
  const profile = request.auth?.credentials?.profile

  return profile?.id
    ? { id: profile.id, displayName: profile.displayName }
    : undefined
}

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
    const guide = await captureGuide(uploadId, request.payload, signedInUser(request))

    request.logger.info({ documentId: guide.id }, 'Captured guide')
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
