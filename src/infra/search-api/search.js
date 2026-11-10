import { searchApiClient } from './client.js'

/**
 * Search the guides' sections for words, the best matches first, a page at a
 * time.
 *
 * @param {Object} options
 * @param {string} options.words - Searched for, at most 500 characters
 * @param {string} [options.guideId] - Search inside this guide only
 * @param {number} [options.limit] - Page size, 1 to 1000
 * @param {number} [options.offset] - How many matches come before the page
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is
 *   `{ queryId, total, results, tooManyMatches, message }`
 * @throws {SearchApiError} - When response is not ok
 */
async function searchSections (options) {
  return searchApiClient.request('/v1/search', {
    query: {
      q: options.words,
      tag: options.guideId,
      limit: options.limit,
      offset: options.offset
    }
  })
}

/**
 * Search the guides for words, a page of guides at a time, each guide ranked
 * by its best section and given with its best few.
 *
 * @param {Object} options
 * @param {string} options.words - Searched for, at most 500 characters
 * @param {number} [options.sections] - Each guide's sections to give, 1 to 20
 * @param {number} [options.limit] - Guides per page, 1 to 1000
 * @param {number} [options.offset] - How many guides come before the page
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is
 *   `{ queryId, total, sectionTotal, results, tooManyMatches, message }`,
 *   each result `{ documentId, documentTitle, sectionTotal, sections, ... }`
 * @throws {SearchApiError} - When response is not ok
 */
async function searchDocuments (options) {
  return searchApiClient.request('/v1/search', {
    query: {
      q: options.words,
      group: 'document',
      sections: options.sections,
      limit: options.limit,
      offset: options.offset
    }
  })
}

export {
  searchDocuments,
  searchSections
}
