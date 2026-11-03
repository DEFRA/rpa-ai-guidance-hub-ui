/**
 * @module The hub's filters and sort, as the prototype's hub has them, on each
 * guide's details. The options, their labels and their counts are the API's,
 * from the reference data; the prototype gives only the layout. Filters live
 * in the address alone, so a filtered list can be shared and bookmarked, and
 * works without JavaScript.
 */

import { SCHEME_YEAR } from '../../constants/scheme-year.js'
import { NOT_SCHEME_SPECIFIC } from '../../services/reference-data.js'
import { displayLabel } from '../create-guidance/upload-guide/metadata/view-helpers.js'

/** The filters, by the name each has in the address and in the API. */
const FILTER_NAMES = Object.freeze(['audience', 'system', 'scheme'])

const DEFAULT_SORT = 'updated-newest'

// "Most relevant" needs something searched for, so it waits for search.
const SORTS = Object.freeze([
  { value: DEFAULT_SORT, text: 'Recently updated' },
  { value: 'updated-oldest', text: 'Oldest updated' },
  { value: 'most-relevant', text: 'Most relevant', disabled: true }
])

const LEGENDS = Object.freeze({ audience: "Who it's for", system: 'System used', scheme: 'Scheme' })

// The address's name for choosing the guides specific to no scheme, beside the
// schemes chosen.
const NO_SCHEME = 'no_scheme'

/**
 * @param {unknown} value - A query parameter: missing, one value, or several
 * @returns {string[]} The non-empty values
 */
function _values (value) {
  return [value].flat().filter((item) => typeof item === 'string' && item !== '')
}

/**
 * The filters chosen in the address.
 *
 * @param {Object} query - The request's query
 * @returns {import('../../services/guides.js').Filters}
 */
function filtersFrom (query = {}) {
  return {
    ...Object.fromEntries(FILTER_NAMES.map((name) => [name, _values(query[name])])),
    noScheme: query[NO_SCHEME] === 'true'
  }
}

/**
 * The sort chosen in the address, or the default for anything else.
 *
 * @param {Object} query - The request's query
 * @returns {string}
 */
function sortFrom (query = {}) {
  const sort = SORTS.find((option) => !option.disabled && option.value === query.sort)

  return sort ? sort.value : DEFAULT_SORT
}

/**
 * The words searched for in the address (`q`), without the spaces around
 * them; none for anything but one value.
 *
 * @param {Object} query - The request's query
 * @returns {string}
 */
function wordsFrom (query = {}) {
  return typeof query.q === 'string' ? query.q.trim() : ''
}

/**
 * The address of a list with these filters and sort: the words searched for
 * first, then each value a repeated parameter, and the sort only when it is
 * not the default.
 *
 * @param {string} path
 * @param {import('../../services/guides.js').Filters} filters
 * @param {string} [sort]
 * @param {string} [words] - Searched for, kept as the filters change
 * @returns {string}
 */
function listHref (path, filters, sort = DEFAULT_SORT, words = '') {
  const params = new URLSearchParams()

  if (words) {
    params.append('q', words)
  }

  FILTER_NAMES.forEach((name) => filters[name].forEach((value) => params.append(name, value)))

  if (filters.noScheme) {
    params.append(NO_SCHEME, 'true')
  }

  if (sort !== DEFAULT_SORT) {
    params.set('sort', sort)
  }

  const query = params.toString()

  return query ? `${path}?${query}` : path
}

/**
 * @private
 * @param {import('../../services/guides.js').Filters} filters
 * @param {string} name
 * @param {string} value
 * @returns {import('../../services/guides.js').Filters} `filters` without
 *   that one value
 */
function _without (filters, name, value) {
  return { ...filters, [name]: filters[name].filter((chosen) => chosen !== value) }
}

/**
 * @private
 * @param {{label: string|null, shortLabel: string|null, count: number}} option
 *   - Counted; no label for the guides with none of the filter's values, which
 *   only the scheme counts, as the guides specific to no scheme
 * @param {import('../../services/guides.js').Filters} filters - Chosen
 * @param {string} name - The filter's
 * @returns {Object}
 */
function _option (option, filters, name) {
  if (option.label === null) {
    return { name: NO_SCHEME, value: 'true', text: NOT_SCHEME_SPECIFIC, count: option.count, checked: filters.noScheme, disabled: false }
  }

  return { value: option.label, text: displayLabel(option), count: option.count, checked: filters[name].includes(option.label), disabled: false }
}

/**
 * @private
 * @param {string} name
 * @param {Array<{label: string|null, shortLabel: string|null, count: number}>} counted
 * @param {import('../../services/guides.js').Filters} filters - Chosen
 * @returns {{name: string, legend: string, options: Array<object>}}
 */
function _group (name, counted, filters) {
  return {
    name,
    legend: LEGENDS[name],
    options: counted.map((option) => _option(option, filters, name))
  }
}

/**
 * The filter panel for a list: each filter with the values the guides have
 * and their counts (scheme only when there is more than one), the fixed scheme
 * year, the chosen values as tags that each take one away, and the sort where
 * the list can be sorted.
 *
 * @param {Object} panel
 * @param {string} panel.path - The list's address, without its query
 * @param {import('../../services/guides.js').Filters} panel.filters - Chosen
 * @param {import('../../services/guides.js').FilterCounts} panel.counts - The API's
 * @param {string} panel.sort - Chosen
 * @param {number} panel.total - How many guides the list shows
 * @param {boolean} panel.withSort - Whether the list can be sorted
 * @param {string} [panel.words] - Searched for, which the form and every
 *   address it makes keep
 * @returns {Object}
 */
function filterPanel ({ path, filters, counts, sort, total, withSort, words = '' }) {
  const counted = (name) => counts[name] ?? []
  const groups = [
    _group('audience', counted('audience'), filters),
    _group('system', counted('system'), filters),
    {
      name: 'year',
      legend: 'Scheme year',
      // The only scheme year there is, for now: shown, checked and fixed,
      // filtering nothing.
      options: [{ value: String(SCHEME_YEAR), text: String(SCHEME_YEAR), count: total, checked: true, disabled: true }]
    },
    ...(counted('scheme').length > 1 ? [_group('scheme', counted('scheme'), filters)] : [])
  ]

  const selected = [
    ...FILTER_NAMES.flatMap((name) => filters[name].map((value) => {
      const option = counted(name).find((known) => known.label === value) ?? { label: value }

      return { text: displayLabel(option), href: listHref(path, _without(filters, name, value), sort, words) }
    })),
    ...(filters.noScheme ? [{ text: NOT_SCHEME_SPECIFIC, href: listHref(path, { ...filters, noScheme: false }, sort, words) }] : [])
  ]

  return {
    action: path,
    words,
    groups,
    selected,
    clearHref: listHref(path, filtersFrom(), sort, words),
    sort: withSort
      ? { options: SORTS.map((option) => ({ ...option, selected: option.value === sort, disabled: Boolean(option.disabled) })) }
      : null
  }
}

export {
  filterPanel,
  filtersFrom,
  listHref,
  sortFrom,
  wordsFrom
}
