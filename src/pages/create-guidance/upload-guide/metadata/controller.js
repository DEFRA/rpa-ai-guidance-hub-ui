import { statusCodes } from '../../../../constants/status-codes.js'
import { getGuideUpload, setGuideUploadMetadata } from '../../session.js'
import { getSchemes, normalizeSchemes } from '../../../../services/reference-data.js'
import { GuideDetailsViewModel } from './view-models.js'

const METADATA_VIEW = 'create-guidance/upload-guide/metadata/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'

async function getMetadataForm (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const savedMetadata = upload.metadata || {}
  const schemeOptions = await getSchemes()

  const viewModel = GuideDetailsViewModel.fromSession({
    values: savedMetadata,
    schemeOptions
  })

  return h
    .view(METADATA_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Validation failAction for metadata form submission
 */
async function metadataFailAction (request, h, err) {
  const schemeOptions = await getSchemes()

  const payload = {
    ...request.payload,
    schemes: normalizeSchemes(request.payload.schemes)
  }

  const viewModel = GuideDetailsViewModel.fromValidationError(
    payload,
    err,
    { schemeOptions }
  )

  return h
    .view(METADATA_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
    .takeover()
}

/**
 * Handle form submission on Screen 1
 */
async function saveMetadata (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  setGuideUploadMetadata(request, {
    guideTitle: request.payload.guideTitle,
    schemes: normalizeSchemes(request.payload.schemes)
  })

  return h.redirect(PURPOSE_URL)
}

export {
  getMetadataForm,
  metadataFailAction,
  saveMetadata
}
