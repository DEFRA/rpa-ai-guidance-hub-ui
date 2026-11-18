import nock from 'nock'

import * as searchApi from '../../../fixtures/search-api.js'
import * as sts from '../../../fixtures/sts.js'

import { SearchApiClient, SearchApiError } from '../../../../src/infra/search-api/client.js'

const TEST_BASE_URL = 'http://test-search-api'

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('SearchApiClient', () => {
  let client

  beforeEach(() => {
    client = new SearchApiClient(TEST_BASE_URL)
  })

  test('request() returns parsed JSON on 200 OK', async () => {
    const body = searchApi.searchResponse()
    nock(TEST_BASE_URL).get('/v1/search').query({ q: 'claim' }).reply(200, body)

    const result = await client.request('/v1/search', { query: { q: 'claim' } })

    expect(result).toMatchObject({ ok: true, status: 200, data: body })
  })

  test('request() uses SEARCH_API_BASE_URL when given no base URL', async () => {
    const body = searchApi.searchResponse()
    const scope = nock(process.env.SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(200, body)

    const result = await new SearchApiClient().request('/v1/search', { query: { q: 'claim' } })

    expect(scope.isDone()).toBe(true)
    expect(result.data).toEqual(body)
  })

  test('request() throws SearchApiError on unexpected non-ok status', async () => {
    nock(TEST_BASE_URL).get('/v1/search').query(true).reply(500)

    await expect(client.request('/v1/search', { query: { q: 'claim' } })).rejects.toThrow(SearchApiError)
  })

  test('SearchApiError contains status code and message', () => {
    const err = SearchApiError.fromResponse('GET', '/v1/search', {
      status: 503,
      statusText: 'Service Unavailable'
    })

    expect(err.statusCode).toBe(503)
    expect(err.message).toBe('search API GET /v1/search failed: 503 Service Unavailable')
  })
})

describe('SearchApiClient authentication', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function createClient () {
    const module = await import('../../../../src/infra/search-api/client.js')

    return new module.SearchApiClient(TEST_BASE_URL)
  }

  // Records the Authorization header the request carried, or null if none
  function interceptSearchCapturingAuthorization () {
    const captured = { authorization: null }

    const scope = nock(TEST_BASE_URL)
      .matchHeader('authorization', (value) => {
        captured.authorization = value ?? null
        return true
      })
      .get('/v1/search')
      .query(true)
      .reply(200, searchApi.searchResponse())

    return { scope, captured }
  }

  describe('when SEARCH_API_AUTH is not set', () => {
    beforeEach(() => {
      vi.stubEnv('SEARCH_API_AUTH', undefined)
    })

    test('sends no Authorization header', async () => {
      const { captured } = interceptSearchCapturingAuthorization()

      const client = await createClient()
      await client.request('/v1/search', { query: { q: 'claim' } })

      expect(captured.authorization).toBeNull()
    })
  })

  describe('when SEARCH_API_AUTH is "web-identity"', () => {
    beforeEach(() => {
      vi.stubEnv('SEARCH_API_AUTH', 'web-identity')
      vi.stubEnv('AWS_REGION', sts.STS_REGION)
      vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-access-key')
      vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret-key')
    })

    test('sends an STS web identity token for the configured audience as a bearer token', async () => {
      vi.stubEnv('SEARCH_API_AUDIENCE', 'search-api-audience')
      sts.interceptGetWebIdentityToken({
        audience: 'search-api-audience',
        body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-search' })
      })
      const { captured } = interceptSearchCapturingAuthorization()

      const client = await createClient()
      await client.request('/v1/search', { query: { q: 'claim' } })

      expect(captured.authorization).toBe('Bearer sts-jwt-search')
    })

    test('requests the token for rpa_ai_guidance_hub_search when SEARCH_API_AUDIENCE is not set', async () => {
      vi.stubEnv('SEARCH_API_AUDIENCE', undefined)
      const { captured } = sts.interceptGetWebIdentityToken()
      interceptSearchCapturingAuthorization()

      const client = await createClient()
      await client.request('/v1/search', { query: { q: 'claim' } })

      expect(captured.body['Audience.member.1']).toBe('rpa_ai_guidance_hub_search')
    })

    test('rejects without calling search when STS refuses the token', async () => {
      sts.interceptGetWebIdentityToken({ body: sts.stsErrorResponse({ message: 'not allowed' }), status: 403 })
      const { scope: search } = interceptSearchCapturingAuthorization()

      const client = await createClient()

      await expect(client.request('/v1/search', { query: { q: 'claim' } })).rejects.toThrow('not allowed')
      expect(search.isDone()).toBe(false)
    })
  })
})
