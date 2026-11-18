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

/**
 * One document in `GET /v1/search?group=document`'s results.
 *
 * @param {Object} [overrides] - Replaces any default field
 * @returns {Object}
 */
function documentResult (overrides = {}) {
  const sections = overrides.sections ?? [sectionResult()]

  return {
    documentId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    documentTitle: 'Countryside Stewardship final payments',
    versionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    status: 'published',
    url: '/guides/7c9e6679-7425-40de-944b-e07fc1f90ae7',
    titleMatch: null,
    sectionTotal: sections.length,
    sections,
    ...overrides
  }
}

/**
 * One document in `GET /v1/search?group=document`'s `titles`: a guide whose
 * title the words cover, its covered words marked.
 *
 * @param {Object} [overrides] - Replaces any default field
 * @returns {Object}
 */
function titleResult (overrides = {}) {
  const title = overrides.documentTitle ?? 'CS MA Claim - AB12 or OP3 Maximum Eligible Weight'

  return documentResult({
    documentId: '9b2f4c1a-5d3e-4a6b-8c7d-0e1f2a3b4c5d',
    documentTitle: title,
    url: '/guides/9b2f4c1a-5d3e-4a6b-8c7d-0e1f2a3b4c5d',
    titleMatch: {
      snippet: [
        { text: 'CS MA Claim', match: true },
        { text: title.slice('CS MA Claim'.length), match: false }
      ]
    },
    sections: [],
    ...overrides
  })
}

/**
 * Body of `GET /v1/search?q=&group=document` on 200.
 *
 * @param {Object} [options]
 * @param {Array<Object>} [options.results] - Defaults to one document
 * @param {number} [options.total] - Defaults to how many results there are
 * @param {number} [options.sectionTotal] - Defaults to the sections of every
 *   guide in `results` and `titles`, each guide counted once
 * @param {Array<Object>} [options.titles] - The guides whose title the words
 *   cover; defaults to none
 * @param {number} [options.documentTotal] - Defaults to the guides in
 *   `results` and `titles`
 * @returns {Object}
 */
function documentSearchResponse (options = {}) {
  const results = options.results ?? [documentResult()]
  const titles = options.titles ?? []
  const every = new Map([...results, ...titles].map((result) => [result.documentId, result]))

  return {
    queryId: '0f8fad5bd9cb469fa16570867728950e',
    total: options.total ?? results.length,
    documentTotal: options.documentTotal ?? every.size,
    sectionTotal: options.sectionTotal ?? [...every.values()].reduce((sum, result) => sum + result.sectionTotal, 0),
    results,
    titles,
    tooManyMatches: false,
    message: null
  }
}

/**
 * Body of `GET /v1/search?q=&group=document` on 200 when more sections match
 * than the service will give.
 *
 * @param {number} [sectionTotal]
 * @returns {Object}
 */
function tooManyDocumentsResponse (sectionTotal = 1500) {
  return {
    queryId: '0f8fad5bd9cb469fa16570867728950e',
    total: 0,
    documentTotal: 0,
    sectionTotal,
    results: [],
    titles: [],
    tooManyMatches: true,
    message: TOO_MANY_MATCHES
  }
}

export {
  documentResult,
  documentSearchResponse,
  searchResponse,
  sectionResult,
  titleResult,
  tooManyDocumentsResponse,
  tooManyMatchesResponse
}
