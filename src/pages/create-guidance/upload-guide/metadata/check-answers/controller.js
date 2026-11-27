import { statusCodes } from '../../../../../constants/status-codes.js'
import { clearGuideUpload, flashConvertedGuide, getGuideUpload, setGuideUploadSubmitted } from '../../../session.js'
import { createGuide, createVersion, getGuideById, RESULTS as GUIDE_RESULTS } from '../../../../../services/guides.js'
import * as referenceData from '../../../../../services/reference-data.js'
import { getStagedDocumentById } from '../../../../../services/staged-documents.js'
import { buildCheckAnswersSchema } from './schemas/check-answers-schema.js'
import { CheckAnswersViewModel } from './view-models.js'

const CHECK_ANSWERS_VIEW = 'create-guidance/upload-guide/metadata/check-answers/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const CONVERTED_URL = '/create-guidance/upload-guide/converted'
const CONVERTING_URL = '/create-guidance/upload-guide/converting'

// Why the API would not convert the upload, as the user is told it, given the
// title of the guide it is a new version of: named once, by the API's answer,
// so that one test holds the words and the rest name them.
const REFUSAL_MESSAGES = Object.freeze({
  [GUIDE_RESULTS.UPLOAD_EXPIRED]: () => 'The uploaded document has expired. Start again and upload it again',
  [GUIDE_RESULTS.PARSE_PENDING]: () => 'The uploaded document is still being processed. Wait a few seconds, then select Convert document again',
  [GUIDE_RESULTS.PARSE_FAILED]: () => 'The uploaded document cannot be opened. Check you selected the correct file and that it has not been corrupted, then start over and upload it again. If this keeps happening, contact the support team',
  [GUIDE_RESULTS.REPLACED_FIRST]: (guideTitle) => `Someone saved a newer version of ‘${guideTitle}’ after you chose it. Check the newer version, then upload your file again`,
  [GUIDE_RESULTS.KEPT_FOR_ANOTHER]: () => 'This document is already being converted into the guide you chose first. Choose that guide again, or start again and upload the document again'
})

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
 * than trusting that a screen was ever completed at all. Not once the API
 * has accepted the answers: they are fixed then, so an option retired since
 * is one the user could not change.
 *
 * @private
 * @param {import('../../../session.js').GuideUpload} upload
 * @returns {Promise<{error: Object|null, referenceOptions: Object}>} The
 *   options validated against, for the summary to show short labels from
 */
async function _validateMetadata (upload) {
  const [schemes, systems, audience] = await Promise.all([
    referenceData.getSchemes(),
    referenceData.getSystems(),
    referenceData.getAudiences()
  ])
  const referenceOptions = { schemes, systems, audience }

  if (upload.isSubmitted) {
    return { error: null, referenceOptions }
  }

  const schema = buildCheckAnswersSchema({
    schemeOptions: schemes,
    systemOptions: systems,
    audienceOptions: audience
  })
  // Not the source link again: its rule cannot change, and the API checks it once more
  // when the guide is saved.
  const { error } = schema.validate(upload.metadata, { abortEarly: false, externals: false })

  return { error, referenceOptions }
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
 * document's parse details, the reference options (for short labels) and
 * the title of the guide the upload is a new version of, if it is one.
 *
 * @private
 * @param {import('../../../session.js').GuideUpload} upload
 * @param {Object} referenceOptions - From `_validateMetadata`
 * @returns {Promise<Object>}
 */
async function _summaryData (upload, referenceOptions) {
  const stagedDocument = upload.fileId
    ? await getStagedDocumentById(upload.fileId)
    : null

  const newVersionOf = upload.updatesGuideId
    ? (await getGuideById(upload.updatesGuideId)).title
    : null

  return { metadata: upload.metadata, stagedDocument, referenceOptions, newVersionOf }
}

async function getCheckAnswers (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const { error, referenceOptions } = await _validateMetadata(upload)

  if (error) {
    return h.redirect(_getIncompleteScreenUrl(error))
  }

  const viewModel = CheckAnswersViewModel.fromSession(
    await _summaryData(upload, referenceOptions)
  )

  return h
    .view(CHECK_ANSWERS_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Once the answers are valid, asks the guidance API to convert the upload
 * into a guide, or into a new version of the guide it updates. The API saves
 * it in the background, so the user follows the save on the converting page,
 * which keeps the upload in the session until the save is complete. If the
 * API refuses, the answers are shown again with what went wrong and what to
 * do about it.
 */
async function convertDocument (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const { error, referenceOptions } = await _validateMetadata(upload)

  if (error) {
    const viewModel = CheckAnswersViewModel.fromValidationError(
      await _summaryData(upload, referenceOptions),
      error
    )

    return h
      .view(CHECK_ANSWERS_VIEW, viewModel)
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  const conversion = {
    uploadId: upload.activeUploadId,
    fileId: upload.fileId,
    metadata: upload.metadata,
    user: request.auth.credentials.profile
  }
  const { code } = upload.updatesGuideId
    ? await createVersion(upload.updatesGuideId, { ...conversion, replacesVersionId: upload.replacesVersionId })
    : await createGuide(conversion)

  if (code === GUIDE_RESULTS.SAVE_STARTED) {
    // The API saves the upload with these answers now, so they stay as they are.
    setGuideUploadSubmitted(request)

    return h.redirect(CONVERTING_URL)
  }

  if (code !== GUIDE_RESULTS.GUIDE_CREATED) {
    const summary = await _summaryData(upload, referenceOptions)
    const viewModel = CheckAnswersViewModel.fromSubmissionError(
      CheckAnswersViewModel.fromSession(summary),
      REFUSAL_MESSAGES[code](summary.newVersionOf)
    )

    return h
      .view(CHECK_ANSWERS_VIEW, viewModel)
      .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  // The upload is now a guide, so the next guide starts with a new upload.
  clearGuideUpload(request)
  flashConvertedGuide(request, upload)

  return h.redirect(CONVERTED_URL)
}

export {
  convertDocument,
  getCheckAnswers,
  REFUSAL_MESSAGES
}
