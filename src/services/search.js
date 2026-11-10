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

/**
 * One guide that has the words searched for, with its best sections.
 *
 * @typedef {Object} GuideResult
 * @property {string} id - The guide's
 * @property {string} title - The guide's
 * @property {string} href - The guide in the hub
 * @property {number} sectionTotal - Every one of its sections with the words
 * @property {SearchResult[]} sections - Its best few, best first
 */

/**
 * @typedef {Object} GuideResults
 * @property {boolean} unavailable - The search service could not answer
 * @property {number} total - Every matching guide, not just this page
 * @property {number} sectionTotal - Every matching section, in every guide
 * @property {boolean} tooManyMatches - So many sections match that none are
 *   given
 * @property {GuideResult[]} results - This page's
 */

/** How many of each guide's sections a page of guides shows. */
const SECTIONS_PER_GUIDE = 3

const UNAVAILABLE = Object.freeze({ unavailable: true, total: 0, tooManyMatches: false, results: [] })
const GUIDES_UNAVAILABLE = Object.freeze({ ...UNAVAILABLE, sectionTotal: 0 })

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
 * The guide's own page in the UI. Made here, not taken from the search
 * service's `url`, so a result can only ever link within the hub.
 *
 * @private
 * @param {string} documentId
 * @returns {string}
 */
function _guideHref (documentId) {
  return `/guides/${encodeURIComponent(documentId)}`
}

/**
 * @private
 * @param {{documentId: string, anchor: string}} section
 * @returns {string}
 */
function _href (section) {
  const guide = _guideHref(section.documentId)

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
 * @private
 * @param {Object} document - The search service's
 * @returns {GuideResult}
 */
function _toGuideResult (document) {
  return {
    id: document.documentId,
    title: document.documentTitle,
    href: _guideHref(document.documentId),
    sectionTotal: document.sectionTotal,
    sections: document.sections.map(_toResult)
  }
}

/**
 * Search the guides for words, a page of guides at a time, each with its
 * best few sections. Search is a service of its own: when it can't answer,
 * that is said rather than thrown, so the hub still works without it.
 *
 * @param {Object} options
 * @param {string} options.words
 * @param {number} options.page - From 1
 * @param {number} options.perPage - Guides
 * @returns {Promise<GuideResults>}
 */
async function searchGuides (options) {
  try {
    const { data } = await searchApi.searchDocuments({
      words: options.words,
      sections: SECTIONS_PER_GUIDE,
      limit: options.perPage,
      offset: (options.page - 1) * options.perPage
    })

    return {
      unavailable: false,
      total: data.total,
      sectionTotal: data.sectionTotal,
      tooManyMatches: Boolean(data.tooManyMatches),
      results: data.results.map(_toGuideResult)
    }
  } catch (err) {
    logger.error({ err }, 'Search is unavailable')

    return GUIDES_UNAVAILABLE
  }
}

/**
 * Search one guide for words, a page of its sections at a time; as
 * `searchGuides`, saying rather than throwing when search can't answer.
 *
 * @param {Object} options
 * @param {string} options.words
 * @param {string} options.guideId
 * @param {number} options.page - From 1
 * @param {number} options.perPage - Sections
 * @returns {Promise<SearchResults>}
 */
async function searchGuide (options) {
  try {
    const { data } = await searchApi.searchSections({
      words: options.words,
      guideId: options.guideId,
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
  searchGuide,
  searchGuides
}
