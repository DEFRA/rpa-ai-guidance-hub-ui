import { format, isValid, parseISO } from 'date-fns'

const DATE_FORMAT = 'd MMMM yyyy'

/**
 * Format a staged document's raw (ISO) lastModified timestamp for display.
 *
 * @param {string|null|undefined} dateString
 * @returns {string|null} - Formatted date, or null when missing/unparseable
 *   so callers can fall back to their own default
 */
function formatStagedDocumentDate (dateString) {
  if (!dateString) {
    return null
  }

  const parsed = parseISO(dateString)

  return isValid(parsed) ? format(parsed, DATE_FORMAT) : null
}

/**
 * Map reference options onto the `{value, text}` shape GOV.UK checkbox and
 * radio templates render, accepting either a `label` or a `text` property
 * from the source option.
 *
 * @param {Array<{value: string, label?: string, text?: string}>} [options]
 * @returns {Array<{value: string, text: string}>}
 */
function toCheckboxOptions (options = []) {
  return options.map((option) => ({
    value: option.value,
    text: option.text || option.label
  }))
}

/**
 * Resolve a list of selected reference values to their labels, falling
 * back to the raw value for anything the current option list doesn't know.
 *
 * @param {Array<string>} [values]
 * @param {Array<{value: string, label: string}>} [options]
 * @returns {Array<string>}
 */
function labelsFor (values = [], options = []) {
  const labelByValue = new Map(options.map((option) => [option.value, option.label]))

  return values.map((value) => labelByValue.get(value) ?? value)
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
  labelsFor,
  buildSummaryCard,
  buildSummaryRow
}
