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

  test('sends no Authorization header by default', async () => {
    const scope = nock(TEST_BASE_URL, { badheaders: ['authorization'] }).get('/guides').reply(200, {})

    const client = await createClient()
    await client.request('/guides')

    expect(scope.isDone()).toBe(true)
  })

  test('sends an STS web identity token for the API\'s audience as a bearer token when GUIDANCE_API_AUTH is "web-identity"', async () => {
    vi.stubEnv('GUIDANCE_API_AUTH', 'web-identity')
    vi.stubEnv('GUIDANCE_API_AUDIENCE', 'guidance-api-audience')
    vi.stubEnv('AWS_REGION', sts.STS_REGION)
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-access-key')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret-key')
    sts.interceptGetWebIdentityToken({
      audience: 'guidance-api-audience',
      body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' })
    })

    const scope = nock(TEST_BASE_URL, { reqheaders: { authorization: 'Bearer sts-jwt-a' } })
      .get('/guides')
      .reply(200, {})

    const client = await createClient()
    await client.request('/guides')

    expect(scope.isDone()).toBe(true)
  })
})
