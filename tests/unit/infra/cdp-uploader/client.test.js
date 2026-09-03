import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { CdpUploaderClient, CdpUploaderError } from '../../../../src/infra/cdp-uploader/client.js'
import { config } from '../../../../src/config/config.js'

const TEST_BASE_URL = 'http://cdp-uploader.test'

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('CdpUploaderClient', () => {
  describe('constructor', () => {
    test('uses provided baseUrl when supplied', () => {
      const client = new CdpUploaderClient('http://custom.test')

      expect(client.baseUrl).toBe('http://custom.test')
    })

    test('defaults to config baseUrl when not supplied', () => {
      const client = new CdpUploaderClient()

      expect(client.baseUrl).toBe(config.get('cdpUploader.baseUrl'))
    })
  })

  describe('request', () => {
    test('returns parsed JSON on 200', async () => {
      const client = new CdpUploaderClient(TEST_BASE_URL)

      nock(TEST_BASE_URL).get('/initiate').reply(statusCodes.HTTP_STATUS_OK, { uploadId: 'u1' })

      const response = await client.request('/initiate')

      expect(response).toEqual({ ok: true, status: statusCodes.HTTP_STATUS_OK, data: { uploadId: 'u1' } })
    })

    test('throws when an ok response has no valid JSON body', async () => {
      const client = new CdpUploaderClient(TEST_BASE_URL)

      nock(TEST_BASE_URL).get('/status/x').reply(statusCodes.HTTP_STATUS_OK, 'not json')

      await expect(client.request('/status/x')).rejects.toThrow(SyntaxError)
    })

    test('returns ok:false for a status in the expected list', async () => {
      const client = new CdpUploaderClient(TEST_BASE_URL)

      nock(TEST_BASE_URL).get('/status/xxx').reply(statusCodes.HTTP_STATUS_NOT_FOUND)

      const response = await client.request('/status/xxx', { expected: [statusCodes.HTTP_STATUS_NOT_FOUND] })

      expect(response).toEqual({ ok: false, status: statusCodes.HTTP_STATUS_NOT_FOUND, data: null })
    })

    test('throws CdpUploaderError with the status code for an unexpected non-ok status', async () => {
      const client = new CdpUploaderClient(TEST_BASE_URL)

      nock(TEST_BASE_URL).get('/boom').reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)

      await expect(client.request('/boom')).rejects.toMatchObject({
        name: 'CdpUploaderError',
        statusCode: statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR,
        message: expect.stringMatching(/GET \/boom failed: 500/)
      })
    })

    test('sends the body as JSON with a matching Content-Type header', async () => {
      const client = new CdpUploaderClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .matchHeader('content-type', 'application/json')
        .post('/initiate', { x: 1 })
        .reply(statusCodes.HTTP_STATUS_OK, { ok: true })

      const response = await client.request('/initiate', { method: 'POST', body: { x: 1 } })

      expect(response.ok).toBe(true)
    })

    test('merges caller headers with the defaults', async () => {
      const client = new CdpUploaderClient(TEST_BASE_URL)

      nock(TEST_BASE_URL)
        .matchHeader('x-custom', 'y')
        .get('/initiate')
        .reply(statusCodes.HTTP_STATUS_OK, {})

      const response = await client.request('/initiate', { headers: { 'x-custom': 'y' } })

      expect(response.ok).toBe(true)
    })

    test('sends only the query params with a defined value', async () => {
      const client = new CdpUploaderClient(TEST_BASE_URL)

      // nock only matches a request whose query string is exactly {a: '1'} -
      // if `b` were sent (even as the string 'undefined'), this would not match
      nock(TEST_BASE_URL).get('/initiate').query({ a: '1' }).reply(statusCodes.HTTP_STATUS_OK, {})

      const response = await client.request('/initiate', { query: { a: '1', b: undefined } })

      expect(response.ok).toBe(true)
    })

    test('propagates a network error', async () => {
      const client = new CdpUploaderClient(TEST_BASE_URL)

      nock(TEST_BASE_URL).get('/initiate').replyWithError('network down')

      await expect(client.request('/initiate')).rejects.toThrow('network down')
    })
  })
})

describe('CdpUploaderError', () => {
  test('fromResponse builds a message naming the method, path and status', () => {
    const error = CdpUploaderError.fromResponse('POST', '/initiate', { status: 503, statusText: 'Service Unavailable' })

    expect(error.message).toBe('cdp-uploader API POST /initiate failed: 503 Service Unavailable')
    expect(error.statusCode).toBe(503)
  })
})
