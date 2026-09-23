import { mapValidationError } from '../../../form-errors.js'
import { buildSummaryCard, buildSummaryRow, formatStagedDocumentDate, labelsFor } from '../view-helpers.js'

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

function _valueOrNotProvided (value) {
  return value || NOT_PROVIDED
}

function _labelsOrNotProvided (values, options) {
  const labels = labelsFor(values, options)

  return labels.length ? labels.join(', ') : NOT_PROVIDED
}

/**
 * Build the "guide's details" summary card: title, version, last modified
 * date and scheme, sourced from session metadata and the staged document.
 *
 * @private
 * @param {Object} metadata
 * @param {Object|null} stagedDocument
 * @param {Array<{value: string, label: string}>} schemeOptions
 */
function _buildGuideDetailsCard ({ metadata, stagedDocument, schemeOptions }) {
  return buildSummaryCard({
    title: "The guide's details",
    changeHref: `${METADATA_URL}?from=check`,
    changeVisuallyHiddenText: "the guide's details",
    rows: [
      buildSummaryRow('Guidance title', _valueOrNotProvided(metadata.guideTitle)),
      buildSummaryRow('Version number', _valueOrNotProvided(stagedDocument?.version)),
      buildSummaryRow(
        'Last modified date',
        _valueOrNotProvided(formatStagedDocumentDate(stagedDocument?.lastModified))
      ),
      buildSummaryRow('Scheme', _labelsOrNotProvided(metadata.schemes, schemeOptions))
    ]
  })
}

/**
 * Build the "owner and purpose" summary card, sourced from session
 * metadata and the reference option lists needed to label checkbox
 * answers.
 *
 * @private
 * @param {Object} metadata
 * @param {Array<{value: string, label: string}>} systemOptions
 * @param {Array<{value: string, label: string}>} audienceOptions
 */
function _buildOwnerPurposeCard ({ metadata, systemOptions, audienceOptions }) {
  return buildSummaryCard({
    title: 'Owner and purpose',
    changeHref: `${PURPOSE_URL}?from=check`,
    changeVisuallyHiddenText: 'the owner and purpose',
    rows: [
      buildSummaryRow('Owner email', _valueOrNotProvided(metadata.owner)),
      buildSummaryRow('Purpose of guidance', _valueOrNotProvided(metadata.goal)),
      buildSummaryRow(
        'Required knowledge and training',
        _valueOrNotProvided(metadata.requirements)
      ),
      buildSummaryRow('Systems', _labelsOrNotProvided(metadata.systems, systemOptions)),
      buildSummaryRow(
        'Who is this guidance for?',
        _labelsOrNotProvided(metadata.audience, audienceOptions)
      )
    ]
  })
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
      guideDetailsCard: _buildGuideDetailsCard({
        metadata,
        stagedDocument,
        schemeOptions
      }),
      ownerPurposeCard: _buildOwnerPurposeCard({
        metadata,
        systemOptions,
        audienceOptions
      })
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
    const { guideDetailsCard, ownerPurposeCard } = CheckAnswersViewModel.fromSession(sessionData)

    return new CheckAnswersViewModel({ guideDetailsCard, ownerPurposeCard, errorList })
  }

  pageTitle = 'Check the details before you convert'
  page = 'upload-guide-metadata'
}

export {
  CheckAnswersViewModel
}
