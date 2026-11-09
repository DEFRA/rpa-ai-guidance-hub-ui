import * as searchApi from '../infra/search-api/search.js'
import { createLogger } from '../infra/logging/logger.js'

const logger = createLogger()

/**
 * One section of a guide that has the words searched for.
 *
 * @typedef {Object} SearchResult
 * @property {string} title - The section's number and heading
 * @property {string} href - The section in its guide
 * @property {string} documentTitle - The guide's
 * @property {number} matches - How many times the section has the words
 * @property {Array<{text: string, match: boolean}>} snippet - The first
 *   sentence with the words, in parts, each the words or not
 */

/**
 * @typedef {Object} SearchResults
 * @property {boolean} unavailable - The search service could not answer
 * @property {number} total - Every matching section, not just this page
 * @property {boolean} tooManyMatches - So many sections match that none are
 *   given
 * @property {SearchResult[]} results - This page's
 */

const UNAVAILABLE = Object.freeze({ unavailable: true, total: 0, tooManyMatches: false, results: [] })

/**
 * @private
 * @param {{sectionNumber: string|null, heading: string}} section
 * @returns {string}
 */
function _title (section) {
  if (!section.sectionNumber) {
    return section.heading
  }

  return `${section.sectionNumber} ${section.heading}`
}

/**
 * The section in the UI's own guide page. Made here, not taken from the
 * search service's `url`, so a result can only ever link within the hub.
 *
 * @private
 * @param {{documentId: string, anchor: string}} section
 * @returns {string}
 */
function _href (section) {
  const guide = `/guides/${encodeURIComponent(section.documentId)}`

  if (!section.anchor) {
    return guide
  }

  return `${guide}#${encodeURIComponent(section.anchor)}`
}

/**
 * @private
 * @param {Object} section - The search service's
 * @returns {SearchResult}
 */
function _toResult (section) {
  return {
    title: _title(section),
    href: _href(section),
    documentTitle: section.documentTitle,
    matches: section.matches,
    snippet: section.snippet
  }
}

/**
 * Search the guides for words, a page of sections at a time. Search is a
 * service of its own: when it can't answer, that is said rather than thrown,
 * so the hub still works without it.
 *
 * @param {Object} options
 * @param {string} options.words
 * @param {number} options.page - From 1
 * @param {number} options.perPage
 * @returns {Promise<SearchResults>}
 */
async function searchGuides (options) {
  try {
    const { data } = await searchApi.searchSections({
      words: options.words,
      limit: options.perPage,
      offset: (options.page - 1) * options.perPage
    })

    return {
      unavailable: false,
      total: data.total,
      tooManyMatches: Boolean(data.tooManyMatches),
      results: data.results.map(_toResult)
    }
  } catch (err) {
    logger.error({ err }, 'Search is unavailable')

    return UNAVAILABLE
  }
}

export {
  searchGuides
}
