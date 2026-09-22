import { mapValidationError } from '../../../form-errors.js'
import { formatStagedDocumentDate } from '../view-models.js'

const BACK_URL = '/create-guidance/upload-guide/metadata/purpose'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const NOT_PROVIDED = 'Not provided'

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
 * Resolve a list of selected reference values to their labels, falling
 * back to the raw value for anything the current option list doesn't know
 *
 * @private
 * @param {Array<string>} [values]
 * @param {Array<{value: string, label: string}>} [options]
 * @returns {Array<string>}
 */
function _labelsFor (values = [], options = []) {
  const labelByValue = new Map(options.map((option) => [option.value, option.label]))

  return values.map((value) => labelByValue.get(value) ?? value)
}

function _valueOrNotProvided (value) {
  return value || NOT_PROVIDED
}

function _labelsOrNotProvided (values, options) {
  const labels = _labelsFor(values, options)

  return labels.length ? labels.join(', ') : NOT_PROVIDED
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
  static fromSession ({
    metadata = {},
    stagedDocument = null,
    schemeOptions = [],
    systemOptions = [],
    audienceOptions = []
  } = {}) {
    return new CheckAnswersViewModel({
      guideDetailsCard: {
        title: { text: "The guide's details" },
        actions: {
          items: [{
            text: 'Change',
            href: `${METADATA_URL}?from=check`,
            visuallyHiddenText: "the guide's details"
          }]
        },
        rows: [
          {
            key: { text: 'Guidance title' },
            value: { text: _valueOrNotProvided(metadata.guideTitle) }
          },
          {
            key: { text: 'Version number' },
            value: { text: _valueOrNotProvided(stagedDocument?.version) }
          },
          {
            key: { text: 'Last modified date' },
            value: {
              text: _valueOrNotProvided(
                formatStagedDocumentDate(stagedDocument?.lastModified)
              )
            }
          },
          {
            key: { text: 'Scheme' },
            value: {
              text: _labelsOrNotProvided(metadata.schemes, schemeOptions)
            }
          }
        ]
      },
      ownerPurposeCard: {
        title: { text: 'Owner and purpose' },
        actions: {
          items: [{
            text: 'Change',
            href: `${PURPOSE_URL}?from=check`,
            visuallyHiddenText: 'the owner and purpose'
          }]
        },
        rows: [
          {
            key: { text: 'Owner email' },
            value: { text: _valueOrNotProvided(metadata.owner) }
          },
          {
            key: { text: 'Purpose of guidance' },
            value: { text: _valueOrNotProvided(metadata.goal) }
          },
          {
            key: { text: 'Required knowledge and training' },
            value: { text: _valueOrNotProvided(metadata.requirements) }
          },
          {
            key: { text: 'Systems' },
            value: {
              text: _labelsOrNotProvided(metadata.systems, systemOptions)
            }
          },
          {
            key: { text: 'Who is this guidance for?' },
            value: {
              text: _labelsOrNotProvided(metadata.audience, audienceOptions)
            }
          }
        ]
      }
    })
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
    const viewModel = CheckAnswersViewModel.fromSession(sessionData)

    viewModel.errorList = errorList

    return viewModel
  }

  pageTitle = 'Check the details before you convert'
  page = 'upload-guide-metadata'
}

export {
  CheckAnswersViewModel
}
