import { normalizeSelection } from '../../../../services/reference-data.js'
import { formatIsoDate } from '../../../common/format-date.js'

/**
 * Format a staged document's raw (ISO) lastModified timestamp for display.
 *
 * @param {string|null|undefined} dateString
 * @returns {string|null} - Formatted date, or null when missing/unparseable
 *   so callers can fall back to their own default
 */
const formatStagedDocumentDate = formatIsoDate

/**
 * How a reference option reads to the user: its label with the short label
 * in brackets, e.g. "Sustainable Farming Incentive (SFI)". Just the label
 * when there is no short label, or it is the same as the label (the
 * service's default when the API sends none).
 *
 * @param {{label: string, shortLabel?: string}} option
 * @returns {string}
 */
function displayLabel ({ label, shortLabel }) {
  return shortLabel && shortLabel !== label ? `${label} (${shortLabel})` : label
}

/**
 * The form value for a reference option: its label in lower case with each
 * run of other characters as a single hyphen, e.g. "Siti Agri" is
 * "siti-agri". Labels stay the identity everywhere else (session, schemas,
 * API); this only keeps URL- and markup-unfriendly text out of the form.
 *
 * @param {string} label
 * @returns {string}
 */
function toOptionValue (label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Turn stored labels into the form values `toCheckboxOptions` renders, for
 * ticking the right boxes.
 *
 * @param {string[]|string} [labels]
 * @returns {string[]}
 */
function toOptionValues (labels) {
  return normalizeSelection(labels).map(toOptionValue)
}

/**
 * Turn submitted checkbox values back into the labels of the options they
 * were rendered from. A value matching no option is kept as submitted, so
 * validation rejects it.
 *
 * @param {undefined|string|string[]} submitted
 * @param {Array<{label: string}>} options
 * @returns {string[]}
 */
function toLabels (submitted, options = []) {
  const labelsByValue = new Map(options.map(({ label }) => [toOptionValue(label), label]))

  return normalizeSelection(submitted).map((value) => labelsByValue.get(value) ?? value)
}

/**
 * Map reference options onto the `{value, text}` shape GOV.UK checkbox
 * and radio templates render. The value is the label's `toOptionValue` and
 * the text is the option's `displayLabel`.
 *
 * @param {Array<{label: string, shortLabel?: string}>} [options]
 * @returns {Array<{value: string, text: string}>}
 */
function toCheckboxOptions (options = []) {
  return options.map((option) => ({ value: toOptionValue(option.label), text: displayLabel(option) }))
}

/**
 * Build the `{title, actions, rows}` shape the GOV.UK summary list macro's
 * `card` option expects.
 *
 * @param {string} title
 * @param {string} changeHref
 * @param {string} changeVisuallyHiddenText
 * @param {Array<{key: {text: string}, value: {text: string}}>} rows
 */
function buildSummaryCard ({ title, changeHref, changeVisuallyHiddenText, rows }) {
  return {
    title: { text: title },
    actions: {
      items: [{
        text: 'Change',
        href: changeHref,
        visuallyHiddenText: changeVisuallyHiddenText
      }]
    },
    rows
  }
}

/**
 * Build a single GOV.UK summary list row.
 *
 * @param {string} keyText
 * @param {string} valueText
 */
function buildSummaryRow (keyText, valueText) {
  return {
    key: { text: keyText },
    value: { text: valueText }
  }
}

export {
  displayLabel,
  toOptionValue,
  toOptionValues,
  toLabels,
  formatStagedDocumentDate,
  toCheckboxOptions,
  buildSummaryCard,
  buildSummaryRow
}
