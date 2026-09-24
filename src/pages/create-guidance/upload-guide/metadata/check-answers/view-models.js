import { mapValidationError } from '../../../form-errors.js'
import { buildGuideSummaryCards } from '../../../guide-summary.js'

const BACK_URL = '/create-guidance/upload-guide/metadata/purpose'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'

const FIELD_HREF_MAP = {
  guideTitle: `${METADATA_URL}?from=check`,
  schemes: `${METADATA_URL}?from=check`,
  owner: `${PURPOSE_URL}?from=check`,
  goal: `${PURPOSE_URL}?from=check`,
  requirements: `${PURPOSE_URL}?from=check`,
  systems: `${PURPOSE_URL}?from=check`,
  audience: `${PURPOSE_URL}?from=check`
}

/**
 * CheckAnswersViewModel - Summary of everything captured across the
 * metadata screens.
 */
class CheckAnswersViewModel {
  /**
   * @param {Object} [data={}]
   * @param {Object} [data.guideDetailsCard]
   * @param {Object} [data.ownerPurposeCard]
   * @param {string} [data.backUrl]
   * @param {Array<{text: string, href: string}>} [data.errorList]
   */
  constructor (data = {}) {
    this.guideDetailsCard = data.guideDetailsCard || {}
    this.ownerPurposeCard = data.ownerPurposeCard || {}
    this.backUrl = data.backUrl || BACK_URL
    this.errorList = data.errorList || []
  }

  /**
   * Build the summary rows from session metadata and the reference option
   * lists needed to label the checkbox answers
   */
  static fromSession (sessionData) {
    return new CheckAnswersViewModel(buildGuideSummaryCards(sessionData))
  }

  static fromSubmissionError (data, message) {
    return new CheckAnswersViewModel({
      ...data,
      errorList: [{ text: message, href: '#conversion-error' }]
    })
  }

  /**
   * Build the summary view for a Joi re-validation failure, keeping the
   * summary cards from `fromSession` and adding the error summary above
   * them.
   *
   * @param {Object} sessionData - Same shape as `fromSession`'s argument
   * @param {{details: Array<{path: Array<string>, message: string}>}} err - Joi validation error
   */
  static fromValidationError (sessionData, err) {
    const { errorList } = mapValidationError(err, FIELD_HREF_MAP)
    const { guideDetailsCard, ownerPurposeCard } = CheckAnswersViewModel.fromSession(sessionData)

    return new CheckAnswersViewModel({ guideDetailsCard, ownerPurposeCard, errorList })
  }

  pageTitle = 'Check the details before you convert'
  page = 'upload-guide-metadata'
}

export {
  CheckAnswersViewModel
}
