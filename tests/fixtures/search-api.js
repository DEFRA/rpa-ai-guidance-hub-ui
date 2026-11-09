/**
 * search API response bodies.
 *
 * Single owner of every response shape the search service sends
 * (`rpa-ai-guidance-hub-search`, `GET /v1/search`), so that no two tests can
 * disagree about what upstream actually returns. Each factory returns a fresh
 * value - nothing here is shared mutable state.
 */

const TOO_MANY_MATCHES = 'Too many matches. Be more specific.'

/**
 * One section in `GET /v1/search`'s results.
 *
 * @param {Object} [overrides] - Replaces any default field
 * @returns {Object}
 */
function sectionResult (overrides = {}) {
  return {
    id: 'section-1',
    documentId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    documentTitle: 'Countryside Stewardship final payments',
    versionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    status: 'published',
    sectionNumber: '4.2',
    heading: 'Claim rules',
    headingPath: ['Checks', 'Claim rules'],
    anchor: 'claim-rules',
    url: '/guides/7c9e6679-7425-40de-944b-e07fc1f90ae7#claim-rules',
    exact: true,
    matches: 2,
    snippet: [
      { text: 'Check the ', match: false },
      { text: 'claim', match: true },
      { text: ' was made on time.', match: false }
    ],
    ...overrides
  }
}

/**
 * Body of `GET /v1/search?q=` on 200.
 *
 * @param {Object} [options]
 * @param {Array<Object>} [options.results] - Defaults to one section
 * @param {number} [options.total] - Defaults to how many results there are
 * @returns {Object}
 */
function searchResponse (options = {}) {
  const results = options.results ?? [sectionResult()]

  return {
    queryId: '0f8fad5bd9cb469fa16570867728950e',
    total: options.total ?? results.length,
    results,
    tooManyMatches: false,
    message: null
  }
}

/**
 * Body of `GET /v1/search?q=` on 200 when more sections match than the
 * service will give.
 *
 * @param {number} [total]
 * @returns {Object}
 */
function tooManyMatchesResponse (total = 1500) {
  return {
    queryId: '0f8fad5bd9cb469fa16570867728950e',
    total,
    results: [],
    tooManyMatches: true,
    message: TOO_MANY_MATCHES
  }
}

export {
  searchResponse,
  sectionResult,
  tooManyMatchesResponse
}
