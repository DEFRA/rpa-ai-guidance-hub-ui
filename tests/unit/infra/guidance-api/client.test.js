import nock from 'nock'

import * as sts from '../../../fixtures/sts.js'

import { GuidanceApiClient, GuidanceApiError } from '../../../../src/infra/guidance-api/client.js'

const TEST_BASE_URL = 'http://test-guidance-api'

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('GuidanceApiClient', () => {
  let client

  beforeEach(() => {
    client = new GuidanceApiClient(TEST_BASE_URL)
  })

  test('request() returns parsed JSON on 200 OK', async () => {
    const mockData = { id: 'g-1', content: 'markdown-content' }
    nock(TEST_BASE_URL).get('/guides').reply(200, mockData)

    const result = await client.request('/guides')

    expect(result).toMatchObject({ ok: true, status: 200, data: mockData })
  })

  test('request() sends JSON body and headers when provided', async () => {
    const payload = { source: { uploadId: 'u-1' } }
    // nock only matches a request with this JSON content type and body
    const scope = nock(TEST_BASE_URL, { reqheaders: { 'content-type': 'application/json' } })
      .post('/guides', payload)
      .reply(201, { id: 'g-1' })

    await client.request('/guides', { method: 'POST', body: payload })

    expect(scope.isDone()).toBe(true)
  })

  test('request() handles expected status codes gracefully without throwing', async () => {
    nock(TEST_BASE_URL).get('/documents/123/metadata').reply(404)

    const result = await client.request('/documents/123/metadata', { expected: [404] })

    expect(result).toMatchObject({ ok: false, status: 404, data: null })
  })

  test('request() throws GuidanceApiError on unexpected non-ok status', async () => {
    nock(TEST_BASE_URL).get('/guides').reply(500)

    await expect(client.request('/guides')).rejects.toThrow(GuidanceApiError)
  })

  test('GuidanceApiError contains status code and message', () => {
    const err = GuidanceApiError.fromResponse('POST', '/guides', {
      status: 500,
      statusText: 'Internal Server Error'
    })

    expect(err.statusCode).toBe(500)
    expect(err.message).toBe('guidance API POST /guides failed: 500 Internal Server Error')
  })
})

describe('GuidanceApiClient authentication', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function createClient () {
    const module = await import('../../../../src/infra/guidance-api/client.js')

    return new module.GuidanceApiClient(TEST_BASE_URL)
  }

  // Records the Authorization header the request carried, or null if none
  function interceptGuidesCapturingAuthorization () {
    const captured = { authorization: null }

    const scope = nock(TEST_BASE_URL)
      .matchHeader('authorization', (value) => {
        captured.authorization = value ?? null
        return true
      })
      .get('/guides')
      .reply(200, {})

    return { scope, captured }
  }

  describe('when GUIDANCE_API_AUTH is not set', () => {
    beforeEach(() => {
      vi.stubEnv('GUIDANCE_API_AUTH', undefined)
    })

    test('sends no Authorization header', async () => {
      const { captured } = interceptGuidesCapturingAuthorization()

      const client = await createClient()
      await client.request('/guides')

      expect(captured.authorization).toBeNull()
    })
  })

  describe('when GUIDANCE_API_AUTH is "web-identity"', () => {
    beforeEach(() => {
      vi.stubEnv('GUIDANCE_API_AUTH', 'web-identity')
      vi.stubEnv('AWS_REGION', sts.STS_REGION)
      vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-access-key')
      vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret-key')
    })

    test('sends an STS web identity token for the configured audience as a bearer token', async () => {
      vi.stubEnv('GUIDANCE_API_AUDIENCE', 'guidance-api-audience')
      sts.interceptGetWebIdentityToken({
        audience: 'guidance-api-audience',
        body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' })
      })
      const { captured } = interceptGuidesCapturingAuthorization()

      const client = await createClient()
      await client.request('/guides')

      expect(captured.authorization).toBe('Bearer sts-jwt-a')
    })

    test('requests the token for rpa_ai_guidance_hub_api when GUIDANCE_API_AUDIENCE is not set', async () => {
      vi.stubEnv('GUIDANCE_API_AUDIENCE', undefined)
      const { captured } = sts.interceptGetWebIdentityToken()
      interceptGuidesCapturingAuthorization()

      const client = await createClient()
      await client.request('/guides')

      expect(captured.body['Audience.member.1']).toBe('rpa_ai_guidance_hub_api')
    })

    test('rejects without calling the API when STS refuses the token', async () => {
      sts.interceptGetWebIdentityToken({ body: sts.stsErrorResponse({ message: 'not allowed' }), status: 403 })
      const { scope: api } = interceptGuidesCapturingAuthorization()

      const client = await createClient()

      await expect(client.request('/guides')).rejects.toThrow('not allowed')
      expect(api.isDone()).toBe(false)
    })
  })
})
