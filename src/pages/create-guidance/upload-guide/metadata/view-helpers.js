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
 * Map reference options onto the `{value, text}` shape GOV.UK checkbox
 * and radio templates render. The label is its own form value: it is
 * attribute-escaped on render, so no encoding is needed.
 *
 * @param {Array<{label: string}>} [options]
 * @returns {Array<{value: string, text: string}>}
 */
function toCheckboxOptions (options = []) {
  return options.map(({ label }) => ({ value: label, text: label }))
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
  formatStagedDocumentDate,
  toCheckboxOptions,
  buildSummaryCard,
  buildSummaryRow
}
