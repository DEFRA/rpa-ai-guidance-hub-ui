import { statusCodes } from '../../../../../constants/status-codes.js'
import { getGuideUpload } from '../../../session.js'
import { createGuide } from '../../../../../services/guides.js'
import * as referenceData from '../../../../../services/reference-data.js'
import { getStagedDocumentById } from '../../../../../services/staged-documents.js'
import { buildCheckAnswersSchema } from './schemas/check-answers-schema.js'
import { CheckAnswersViewModel } from './view-models.js'

const CHECK_ANSWERS_VIEW = 'create-guidance/upload-guide/metadata/check-answers/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const HUB_URL = '/hub'

// Which screen owns each field, so an incomplete/invalid answer sends the
// user back to the screen that can fix it rather than a generic error.
const FIELD_PAGE_MAP = {
  guideTitle: METADATA_URL,
  schemes: METADATA_URL,
  owner: PURPOSE_URL,
  goal: PURPOSE_URL,
  requirements: PURPOSE_URL,
  systems: PURPOSE_URL,
  audience: PURPOSE_URL
}

/**
 * Re-validate the metadata captured across both screens against the
 * current reference option lists.
 *
 * The screens validate on submission, but the reference options they
 * validate against can change afterwards (see `buildMetadataSchema`), so
 * this is checked again here from whatever options are current rather
 * than trusting that a screen was ever completed at all.
 *
 * @private
 * @param {Object} metadata
 * @returns {Promise<{error: Object|null, schemeOptions: Array, systemOptions: Array, audienceOptions: Array}>}
 */
async function _validateMetadata (metadata) {
  const [schemeOptions, systemOptions, audienceOptions] = await Promise.all([
    referenceData.getSchemes(),
    referenceData.getSystems(),
    referenceData.getAudiences()
  ])

  const schema = buildCheckAnswersSchema({ schemeOptions, systemOptions, audienceOptions })
  const { error } = schema.validate(metadata, { abortEarly: false })

  return { error, schemeOptions, systemOptions, audienceOptions }
}

/**
 * @private
 * @param {Object} error - Joi validation error
 * @returns {string} URL of the screen that owns the first invalid field
 */
function _getIncompleteScreenUrl (error) {
  const field = error.details[0]?.path[0]

  return FIELD_PAGE_MAP[field] ?? METADATA_URL
}

async function getCheckAnswers (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const {
    error,
    schemeOptions,
    systemOptions,
    audienceOptions
  } = await _validateMetadata(upload.metadata)

  if (error) {
    return h.redirect(_getIncompleteScreenUrl(error))
  }

  const stagedDocument = upload.fileId
    ? await getStagedDocumentById(upload.fileId)
    : null

  const viewModel = CheckAnswersViewModel.fromSession({
    metadata: upload.metadata,
    stagedDocument,
    schemeOptions,
    systemOptions,
    audienceOptions
  })

  return h
    .view(CHECK_ANSWERS_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Once the answers are valid, converts the upload into a guide through
 * the guidance API, then shows the dashboard.
 */
async function convertDocument (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const { error, schemeOptions, systemOptions, audienceOptions } =
    await _validateMetadata(upload.metadata)

  if (error) {
    const stagedDocument = upload.fileId
      ? await getStagedDocumentById(upload.fileId)
      : null

    const viewModel = CheckAnswersViewModel.fromValidationError(
      {
        metadata: upload.metadata,
        stagedDocument,
        schemeOptions,
        systemOptions,
        audienceOptions
      },
      error
    )

    return h
      .view(CHECK_ANSWERS_VIEW, viewModel)
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  await createGuide({
    uploadId: upload.activeUploadId,
    fileId: upload.fileId,
    metadata: upload.metadata,
    user: request.auth.credentials.profile
  })

  return h.redirect(HUB_URL)
}

export {
  convertDocument,
  getCheckAnswers
}
