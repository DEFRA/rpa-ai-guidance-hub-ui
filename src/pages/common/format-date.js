import { format, isValid, parseISO } from 'date-fns'

const DATE_FORMAT = 'd MMMM yyyy'

/**
 * Format an ISO timestamp for display, e.g. "20 July 2025".
 *
 * @param {string|null|undefined} dateString
 * @returns {string|null} - Formatted date, or null when missing/unparseable
 *   so callers can fall back to their own default
 */
function formatIsoDate (dateString) {
  if (!dateString) {
    return null
  }

  const parsed = parseISO(dateString)

  return isValid(parsed) ? format(parsed, DATE_FORMAT) : null
}

export {
  formatIsoDate
}
