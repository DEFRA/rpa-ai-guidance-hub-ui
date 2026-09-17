import { statusCodes } from '../../../../../constants/status-codes.js'
import { getGuideUpload, setGuideUploadMetadata } from '../../../session.js'
import {
  getAudiences,
  getSystems,
  normalizeSelection
} from '../../../../../services/reference-data.js'
import { OwnerAndPurposeViewModel } from './view-models.js'

const PURPOSE_VIEW = 'create-guidance/upload-guide/metadata/purpose/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'

/**
 * Fetch both reference option lists this screen depends on.
 *
 * Shared with the route's payload validator so the schema and the rendered
 * checkbox lists are always built from the same source.
 *
 * @returns {Promise<{systemOptions: Array, audienceOptions: Array}>}
 */
async function getPurposeOptions () {
  const [systemOptions, audienceOptions] = await Promise.all([
    getSystems(),
    getAudiences()
  ])

  return { systemOptions, audienceOptions }
}

/**
 * Where to send a request that hasn't reached this screen through the
 * journey: back to upload if there is no active upload, back to screen 1 if
 * its answers are missing.
 *
 * @private
 * @param {import('@hapi/hapi').Request} request
 * @returns {string|null} Redirect URL, or null when the request may proceed
 */
function _getGuardRedirect (request) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return UPLOAD_GUIDE_URL
  }

  if (!upload.metadata?.guideTitle) {
    return METADATA_URL
  }

  return null
}

async function getPurposeForm (request, h) {
  const redirectUrl = _getGuardRedirect(request)

  if (redirectUrl) {
    return h.redirect(redirectUrl)
  }

  const savedMetadata = getGuideUpload(request).metadata
  const options = await getPurposeOptions()

  const viewModel = OwnerAndPurposeViewModel.fromSession({
    values: savedMetadata,
    ...options
  })

  return h
    .view(PURPOSE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Validation failAction for the owner and purpose form submission
 */
async function purposeFailAction (request, h, err) {
  const options = await getPurposeOptions()

  const payload = {
    ...request.payload,
    systems: normalizeSelection(request.payload.systems),
    audience: normalizeSelection(request.payload.audience)
  }

  const viewModel = OwnerAndPurposeViewModel.fromValidationError(payload, err, options)

  return h
    .view(PURPOSE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
    .takeover()
}

/**
 * Handle form submission on screen 2, completing the metadata capture
 * journey
 */
async function savePurpose (request, h) {
  const redirectUrl = _getGuardRedirect(request)

  if (redirectUrl) {
    return h.redirect(redirectUrl)
  }

  const { owner, goal, requirements, systems, audience } = request.payload

  setGuideUploadMetadata(request, {
    owner,
    goal,
    requirements,
    systems: normalizeSelection(systems),
    audience: normalizeSelection(audience)
  })

  return h.redirect(CHECK_ANSWERS_URL)
}

export {
  getPurposeOptions,
  getPurposeForm,
  purposeFailAction,
  savePurpose
}
