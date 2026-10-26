import {
  buildSummaryCard,
  displayLabel,
  buildSummaryRow,
  formatStagedDocumentDate
} from './upload-guide/metadata/view-helpers.js'

const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const NOT_PROVIDED = 'Not provided'

function _valueOrNotProvided (value) {
  return value || NOT_PROVIDED
}

/**
 * The stored labels as the user reads them, with each one's short label
 * added where the reference options have it. A label with no matching
 * option (e.g. since retired) is shown as stored.
 *
 * @private
 * @param {string[]} [labels]
 * @param {Array<{label: string, shortLabel?: string}>} [options]
 * @returns {string}
 */
function _labelsOrNotProvided (labels = [], options = []) {
  const optionsByLabel = new Map(options.map((option) => [option.label, option]))
  const shown = labels.map((label) => displayLabel(optionsByLabel.get(label) ?? { label }))

  return shown.length ? shown.join(', ') : NOT_PROVIDED
}

/**
 * Build the "guide's details" summary card: title, version, last modified
 * date and scheme, sourced from session metadata and the staged document.
 *
 * Shared by the check-answers screen and the start-over confirmation screen,
 * so both agree on exactly what a guide's details consist of.
 *
 * @param {Object} data
 * @param {Object} data.metadata
 * @param {Object|null} data.stagedDocument
 * @param {Object} [data.referenceOptions] - Reference options by field, to
 *   show short labels
 * @param {string} [data.changeHref] - Defaults to the metadata screen
 */
function buildGuideDetailsCard ({
  metadata,
  stagedDocument,
  referenceOptions = {},
  changeHref = `${METADATA_URL}?from=check`
}) {
  return buildSummaryCard({
    title: "The guide's details",
    changeHref,
    changeVisuallyHiddenText: "the guide's details",
    rows: [
      buildSummaryRow('Guidance title', _valueOrNotProvided(metadata.guideTitle)),
      buildSummaryRow('Version number', _valueOrNotProvided(stagedDocument?.version)),
      buildSummaryRow(
        'Last modified date',
        _valueOrNotProvided(formatStagedDocumentDate(stagedDocument?.lastModified))
      ),
      buildSummaryRow('Scheme', _labelsOrNotProvided(metadata.schemes, referenceOptions.schemes))
    ]
  })
}

/**
 * Build the "owner and purpose" summary card, sourced from session
 * metadata.
 *
 * Shared by the check-answers screen and the start-over confirmation screen,
 * so both agree on exactly what a guide's owner and purpose consist of.
 *
 * @param {Object} data
 * @param {Object} data.metadata
 * @param {Object} [data.referenceOptions] - Reference options by field, to
 *   show short labels
 * @param {string} [data.changeHref] - Defaults to the purpose screen
 */
function buildOwnerPurposeCard ({
  metadata,
  referenceOptions = {},
  changeHref = `${PURPOSE_URL}?from=check`
}) {
  return buildSummaryCard({
    title: 'Owner and purpose',
    changeHref,
    changeVisuallyHiddenText: 'the owner and purpose',
    rows: [
      buildSummaryRow('Owner email', _valueOrNotProvided(metadata.owner)),
      buildSummaryRow('Purpose of guidance', _valueOrNotProvided(metadata.goal)),
      buildSummaryRow(
        'Required knowledge and training',
        _valueOrNotProvided(metadata.requirements)
      ),
      buildSummaryRow('Systems', _labelsOrNotProvided(metadata.systems, referenceOptions.systems)),
      buildSummaryRow(
        'Who is this guidance for?',
        _labelsOrNotProvided(metadata.audience, referenceOptions.audience)
      )
    ]
  })
}

/**
 * Build both summary cards for everything captured against a guide upload -
 * the single definition of what a guide "is", reused wherever it needs
 * summarising (check-answers, start-over).
 *
 * @param {Object} [data={}]
 * @param {Object} [data.metadata={}]
 * @param {Object|null} [data.stagedDocument=null]
 * @param {{schemes?: Array<Object>, systems?: Array<Object>, audience?: Array<Object>}} [data.referenceOptions={}]
 * @returns {{guideDetailsCard: Object, ownerPurposeCard: Object}}
 */
function buildGuideSummaryCards ({
  metadata = {},
  stagedDocument = null,
  referenceOptions = {}
} = {}) {
  return {
    guideDetailsCard: buildGuideDetailsCard({ metadata, stagedDocument, referenceOptions }),
    ownerPurposeCard: buildOwnerPurposeCard({ metadata, referenceOptions })
  }
}

export {
  buildGuideDetailsCard,
  buildOwnerPurposeCard,
  buildGuideSummaryCards
}
