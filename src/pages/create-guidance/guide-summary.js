import {
  buildSummaryCard,
  buildSummaryRow,
  formatStagedDocumentDate,
  labelsFor
} from './upload-guide/metadata/view-helpers.js'

const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const NOT_PROVIDED = 'Not provided'

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
 * Shared by the check-answers screen and the start-over confirmation screen,
 * so both agree on exactly what a guide's details consist of.
 *
 * @param {Object} data
 * @param {Object} data.metadata
 * @param {Object|null} data.stagedDocument
 * @param {Array<{value: string, label: string}>} data.schemeOptions
 * @param {string} [data.changeHref] - Defaults to the metadata screen
 */
function buildGuideDetailsCard ({
  metadata,
  stagedDocument,
  schemeOptions,
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
      buildSummaryRow('Scheme', _labelsOrNotProvided(metadata.schemes, schemeOptions))
    ]
  })
}

/**
 * Build the "owner and purpose" summary card, sourced from session
 * metadata and the reference option lists needed to label checkbox
 * answers.
 *
 * Shared by the check-answers screen and the start-over confirmation screen,
 * so both agree on exactly what a guide's owner and purpose consist of.
 *
 * @param {Object} data
 * @param {Object} data.metadata
 * @param {Array<{value: string, label: string}>} data.systemOptions
 * @param {Array<{value: string, label: string}>} data.audienceOptions
 * @param {string} [data.changeHref] - Defaults to the purpose screen
 */
function buildOwnerPurposeCard ({
  metadata,
  systemOptions,
  audienceOptions,
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
      buildSummaryRow('Systems', _labelsOrNotProvided(metadata.systems, systemOptions)),
      buildSummaryRow(
        'Who is this guidance for?',
        _labelsOrNotProvided(metadata.audience, audienceOptions)
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
 * @param {Array<{value: string, label: string}>} [data.schemeOptions=[]]
 * @param {Array<{value: string, label: string}>} [data.systemOptions=[]]
 * @param {Array<{value: string, label: string}>} [data.audienceOptions=[]]
 * @returns {{guideDetailsCard: Object, ownerPurposeCard: Object}}
 */
function buildGuideSummaryCards ({
  metadata = {},
  stagedDocument = null,
  schemeOptions = [],
  systemOptions = [],
  audienceOptions = []
} = {}) {
  return {
    guideDetailsCard: buildGuideDetailsCard({ metadata, stagedDocument, schemeOptions }),
    ownerPurposeCard: buildOwnerPurposeCard({ metadata, systemOptions, audienceOptions })
  }
}

export {
  buildGuideDetailsCard,
  buildOwnerPurposeCard,
  buildGuideSummaryCards
}
