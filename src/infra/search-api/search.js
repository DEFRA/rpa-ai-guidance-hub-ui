import { searchApiClient } from './client.js'

/**
 * Search the guides' sections for words, the best matches first, a page at a
 * time.
 *
 * @param {Object} options
 * @param {string} options.words - Searched for, at most 500 characters
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
      limit: options.limit,
      offset: options.offset
    }
  })
}

export {
  searchSections
}
