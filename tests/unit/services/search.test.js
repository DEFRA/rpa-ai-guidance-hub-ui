import nock from 'nock'

import * as searchApi from '../../fixtures/search-api.js'

import * as searchSectionsApi from '../../../src/infra/search-api/search.js'
import { searchGuides } from '../../../src/services/search.js'

const SEARCH_API_BASE_URL = process.env.SEARCH_API_BASE_URL

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('#searchGuides', () => {
  test('asks for the page of results, as an offset', async () => {
    const scope = nock(SEARCH_API_BASE_URL)
      .get('/v1/search')
      .query({ q: 'claim', limit: '10', offset: '20' })
      .reply(200, searchApi.searchResponse())

    await searchGuides({ words: 'claim', page: 3, perPage: 10 })

    expect(scope.isDone()).toBe(true)
  })

  test('gives each section as a link to it in its guide, numbered where it has a number', async () => {
    nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(200, searchApi.searchResponse({ total: 25 }))

    const found = await searchGuides({ words: 'claim', page: 1, perPage: 10 })

    expect(found).toEqual({
      unavailable: false,
      total: 25,
      tooManyMatches: false,
      results: [{
        title: '4.2 Claim rules',
        href: '/guides/7c9e6679-7425-40de-944b-e07fc1f90ae7#claim-rules',
        documentTitle: 'Countryside Stewardship final payments',
        matches: 2,
        snippet: [
          { text: 'Check the ', match: false },
          { text: 'claim', match: true },
          { text: ' was made on time.', match: false }
        ]
      }]
    })
  })

  test('gives a section with no number its heading alone, and one with no anchor its guide', async () => {
    const section = searchApi.sectionResult({ sectionNumber: null, heading: 'Introduction', anchor: '' })
    nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(200, searchApi.searchResponse({ results: [section] }))

    const { results } = await searchGuides({ words: 'claim', page: 1, perPage: 10 })

    expect(results[0].title).toBe('Introduction')
    expect(results[0].href).toBe('/guides/7c9e6679-7425-40de-944b-e07fc1f90ae7')
  })

  test('links within the hub, whatever the search service says the section\'s url is', async () => {
    const section = searchApi.sectionResult({ url: 'https://evil.example/' })
    nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(200, searchApi.searchResponse({ results: [section] }))

    const { results } = await searchGuides({ words: 'claim', page: 1, perPage: 10 })

    expect(results[0].href).toBe('/guides/7c9e6679-7425-40de-944b-e07fc1f90ae7#claim-rules')
  })

  test('says when there are too many matches to give', async () => {
    nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(200, searchApi.tooManyMatchesResponse(1500))

    const found = await searchGuides({ words: 'the', page: 1, perPage: 10 })

    expect(found).toEqual({ unavailable: false, total: 1500, tooManyMatches: true, results: [] })
  })

  test('says search is unavailable, rather than throwing, when the service fails', async () => {
    nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(500)

    const found = await searchGuides({ words: 'claim', page: 1, perPage: 10 })

    expect(found).toEqual({ unavailable: true, total: 0, tooManyMatches: false, results: [] })
  })

  test('says search is unavailable when the service can\'t be reached', async () => {
    nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).replyWithError('connect ECONNREFUSED')

    const found = await searchGuides({ words: 'claim', page: 1, perPage: 10 })

    expect(found.unavailable).toBe(true)
  })

  test('says search is unavailable when the service is too slow', async () => {
    // What fetch rejects with when the client's AbortSignal.timeout fires
    vi.spyOn(searchSectionsApi, 'searchSections').mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))

    const found = await searchGuides({ words: 'claim', page: 1, perPage: 10 })

    expect(searchSectionsApi.searchSections).toHaveBeenCalled()
    expect(found.unavailable).toBe(true)
  })

  test('says search is unavailable when no search service is configured', async () => {
    vi.stubEnv('SEARCH_API_BASE_URL', undefined)
    vi.resetModules()
    const unconfigured = await import('../../../src/services/search.js')

    const found = await unconfigured.searchGuides({ words: 'claim', page: 1, perPage: 10 })

    expect(found.unavailable).toBe(true)
    vi.unstubAllEnvs()
  })
})
