import { statusCodes } from '../../../constants/status-codes.js'
import { getGuideUpload, clearGuideUpload } from '../session.js'
import { STEP_IDS } from '../upload-guide/steps.js'
import * as referenceData from '../../../services/reference-data.js'
import { getStagedDocumentById } from '../../../services/staged-documents.js'
import { buildGuideSummaryCards } from '../guide-summary.js'
import { StartOverViewModel } from './view-models.js'

const START_OVER_VIEW = 'create-guidance/start-over/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const DEFAULT_CANCEL_URL = '/create-guidance/upload-guide/metadata'

/**
 * Whether the session's guide upload holds anything worth confirming before
 * discarding - a completed upload, or any metadata captured against it. A
 * missing, in-progress, or failed upload has nothing to lose.
 *
 * @private
 * @param {import('../session.js').GuideUpload|null} upload
 * @returns {boolean}
 */
function _hasProgress (upload) {
  return Boolean(upload?.metadata) || Boolean(upload?.completedStepIds.includes(STEP_IDS.PARSE))
}

/**
 * The page to return to if the user cancels, restricted to a path within
 * this journey so the query string can't be used to redirect elsewhere.
 *
 * @private
 * @param {import('@hapi/hapi').Request} request
 * @returns {string}
 */
function _cancelUrl (request) {
  const returnUrl = request.query?.returnUrl

  return typeof returnUrl === 'string' &&
    returnUrl.startsWith('/create-guidance/') &&
    !returnUrl.startsWith('//')
    ? returnUrl
    : DEFAULT_CANCEL_URL
}

/**
 * Build the same summary cards check-answers would show, so the
 * confirmation page can list exactly what is about to be discarded -
 * including the uploaded file, represented by its parsed version and last
 * modified date.
 *
 * @private
 * @param {import('../session.js').GuideUpload} upload
 * @returns {Promise<{guideDetailsCard: Object, ownerPurposeCard: Object}>}
 */
async function _buildSummaryCards (upload) {
  const [stagedDocument, schemeOptions, systemOptions, audienceOptions] = await Promise.all([
    upload.fileId ? getStagedDocumentById(upload.fileId) : null,
    referenceData.getSchemes(),
    referenceData.getSystems(),
    referenceData.getAudiences()
  ])

  return buildGuideSummaryCards({
    metadata: upload.metadata ?? {},
    stagedDocument,
    schemeOptions,
    systemOptions,
    audienceOptions
  })
}

/**
 * Offer to start the guide-creation journey over.
 *
 * Resets immediately when there is nothing to lose (no upload, one still in
 * progress, or a failed one); otherwise shows what would be discarded and
 * asks for confirmation first.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getStartOver (request, h) {
  const upload = getGuideUpload(request)

  if (!_hasProgress(upload)) {
    clearGuideUpload(request)

    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const { guideDetailsCard, ownerPurposeCard } = await _buildSummaryCards(upload)

  return h
    .view(START_OVER_VIEW, new StartOverViewModel({
      cancelUrl: _cancelUrl(request),
      guideDetailsCard,
      ownerPurposeCard
    }))
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Clear the guide-upload session and send the user back to the start of the
 * journey.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function postStartOver (request, h) {
  clearGuideUpload(request)

  return h.redirect(UPLOAD_GUIDE_URL)
}

export {
  getStartOver,
  postStartOver
}
