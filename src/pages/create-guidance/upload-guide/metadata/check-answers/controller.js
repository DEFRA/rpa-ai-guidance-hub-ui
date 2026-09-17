import { statusCodes } from '../../../../../constants/status-codes.js'
import { getGuideUpload } from '../../../session.js'
import {
  getAudiences,
  getSchemes,
  getSystems
} from '../../../../../services/reference-data.js'
import { CheckAnswersViewModel } from './view-models.js'

const CHECK_ANSWERS_VIEW = 'create-guidance/upload-guide/metadata/check-answers/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'

/**
 * Send a request that hasn't completed both metadata screens back to the
 * first one it is missing
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

  if (!upload.metadata?.owner) {
    return PURPOSE_URL
  }

  return null
}

async function getCheckAnswers (request, h) {
  const redirectUrl = _getGuardRedirect(request)

  if (redirectUrl) {
    return h.redirect(redirectUrl)
  }

  const metadata = getGuideUpload(request).metadata
  const [schemeOptions, systemOptions, audienceOptions] = await Promise.all([
    getSchemes(),
    getSystems(),
    getAudiences()
  ])

  const viewModel = CheckAnswersViewModel.fromSession({
    metadata,
    schemeOptions,
    systemOptions,
    audienceOptions
  })

  return h
    .view(CHECK_ANSWERS_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getCheckAnswers
}
