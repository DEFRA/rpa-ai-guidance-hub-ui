import { statusCodes } from '../../../../../constants/status-codes.js'
import { clearGuideUpload, getGuideUpload } from '../../../session.js'
import { createGuide, RESULTS as GUIDE_RESULTS } from '../../../../../services/guides.js'
import * as referenceData from '../../../../../services/reference-data.js'
import { getStagedDocumentById } from '../../../../../services/staged-documents.js'
import { buildCheckAnswersSchema } from './schemas/check-answers-schema.js'
import { CheckAnswersViewModel } from './view-models.js'

const CHECK_ANSWERS_VIEW = 'create-guidance/upload-guide/metadata/check-answers/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const HUB_URL = '/hub'

// Why the API would not convert the upload, as the user is told it.
const REFUSAL_MESSAGES = {
  [GUIDE_RESULTS.UPLOAD_EXPIRED]: 'The uploaded document has expired. Start again and upload it again',
  [GUIDE_RESULTS.PARSE_PENDING]: 'The uploaded document is still being processed. Wait a few seconds, then select Convert document again',
  [GUIDE_RESULTS.PARSE_FAILED]: 'The uploaded document cannot be opened. Check you selected the correct file and that it has not been corrupted, then start over and upload it again. If this keeps happening, contact the support team'
}

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

/**
 * What the summary cards are built from: the answers, the staged
 * document's parse details, and the option lists that label them.
 *
 * @private
 * @param {import('../../../session.js').GuideUpload} upload
 * @param {{schemeOptions: Array, systemOptions: Array, audienceOptions: Array}} options
 * @returns {Promise<Object>}
 */
async function _summaryData (upload, options) {
  const stagedDocument = upload.fileId
    ? await getStagedDocumentById(upload.fileId)
    : null

  return { metadata: upload.metadata, stagedDocument, ...options }
}

async function getCheckAnswers (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const { error, ...options } = await _validateMetadata(upload.metadata)

  if (error) {
    return h.redirect(_getIncompleteScreenUrl(error))
  }

  const viewModel = CheckAnswersViewModel.fromSession(
    await _summaryData(upload, options)
  )

  return h
    .view(CHECK_ANSWERS_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Once the answers are valid, converts the upload into a guide through
 * the guidance API, then shows the dashboard. If the API refuses, the
 * answers are shown again with what went wrong and what to do about it.
 */
async function convertDocument (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const { error, ...options } = await _validateMetadata(upload.metadata)

  if (error) {
    const viewModel = CheckAnswersViewModel.fromValidationError(
      await _summaryData(upload, options),
      error
    )

    return h
      .view(CHECK_ANSWERS_VIEW, viewModel)
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  const { code } = await createGuide({
    uploadId: upload.activeUploadId,
    fileId: upload.fileId,
    metadata: upload.metadata,
    user: request.auth.credentials.profile
  })

  if (code !== GUIDE_RESULTS.GUIDE_CREATED) {
    const viewModel = CheckAnswersViewModel.fromSubmissionError(
      CheckAnswersViewModel.fromSession(await _summaryData(upload, options)),
      REFUSAL_MESSAGES[code]
    )

    return h
      .view(CHECK_ANSWERS_VIEW, viewModel)
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  // The upload is now a guide, so the next guide starts with a new upload.
  clearGuideUpload(request)

  return h.redirect(HUB_URL)
}

export {
  convertDocument,
  getCheckAnswers
}
