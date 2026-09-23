import { statusCodes } from '../../../../constants/status-codes.js'
import { getGuideUpload, setGuideUploadMetadata } from '../../session.js'
import { getSchemes, normalizeSchemes } from '../../../../services/reference-data.js'
import { getStagedDocumentById } from '../../../../services/staged-documents.js'
import { GuideDetailsViewModel } from './view-models.js'

const METADATA_VIEW = 'create-guidance/upload-guide/metadata/page.njk'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'

function isChangingFromCheck (request) {
  return request.query?.from === 'check'
}

async function getMetadataForm (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const stagedDocument = upload.fileId
    ? await getStagedDocumentById(upload.fileId)
    : null

  const savedMetadata = upload.metadata || {}
  const schemeOptions = await getSchemes()
  const [notification] = request.yar.flash('uploadNotification')

  const viewModel = GuideDetailsViewModel.fromSession({
    values: savedMetadata,
    stagedDocument,
    schemeOptions,
    notification,
    backUrl: isChangingFromCheck(request) ? CHECK_ANSWERS_URL : null,
    formAction: isChangingFromCheck(request)
      ? `${METADATA_URL}?from=check`
      : METADATA_URL
  })

  return h
    .view(METADATA_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Validation failAction for metadata form submission
 */
async function metadataFailAction (request, h, err) {
  const upload = getGuideUpload(request)
  const stagedDocument = upload?.fileId
    ? await getStagedDocumentById(upload.fileId)
    : null
  const schemeOptions = await getSchemes()

  const payload = {
    ...request.payload,
    schemes: normalizeSchemes(request.payload.schemes)
  }

  const viewModel = GuideDetailsViewModel.fromValidationError(
    payload,
    err,
    {
      schemeOptions,
      stagedDocument,
      backUrl: isChangingFromCheck(request) ? CHECK_ANSWERS_URL : null,
      formAction: isChangingFromCheck(request)
        ? `${METADATA_URL}?from=check`
        : METADATA_URL
    }
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

  return h.redirect(
    isChangingFromCheck(request) ? CHECK_ANSWERS_URL : PURPOSE_URL
  )
}

export {
  getMetadataForm,
  metadataFailAction,
  saveMetadata
}
