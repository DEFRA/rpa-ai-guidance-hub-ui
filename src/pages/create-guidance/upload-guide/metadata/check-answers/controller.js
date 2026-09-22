import { statusCodes } from '../../../../../constants/status-codes.js'
import { getGuideUpload } from '../../../session.js'
import * as referenceData from '../../../../../services/reference-data.js'
import { getStagedDocumentById } from '../../../../../services/staged-documents.js'
import { buildCheckAnswersSchema } from './schemas/check-answers-schema.js'
import { CheckAnswersViewModel } from './view-models.js'

const CHECK_ANSWERS_VIEW = 'create-guidance/upload-guide/metadata/check-answers/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const DASHBOARD_URL = '/designer/dashboard'

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
 * Persisting the guide via the guidance API is tracked separately; once
 * the answers are valid this redirects straight to the dashboard.
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

  return h.redirect(DASHBOARD_URL)
}

export {
  convertDocument,
  getCheckAnswers
}
