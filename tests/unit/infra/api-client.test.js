import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { ApiClient } from '../../../src/infra/api-client.js'

class TestApiError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.name = 'TestApiError'
    this.statusCode = statusCode
  }

  static fromResponse (method, path, response) {
    return new TestApiError(`API ${method} ${path} failed: ${response.status}`, response.status)
  }
}

const TEST_BASE_URL = 'http://api.test'

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('ApiClient', () => {
  describe('request', () => {
    test('returns parsed JSON on 200', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/items').reply(statusCodes.HTTP_STATUS_OK, { items: [1, 2] })

      const response = await client.request('/items')

      expect(response).toMatchObject({ ok: true, status: statusCodes.HTTP_STATUS_OK, data: { items: [1, 2] } })
    })

    test('reads an ok body as text when asked', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/doc').reply(statusCodes.HTTP_STATUS_OK, '# Title', { 'Content-Type': 'text/plain' })

      const response = await client.request('/doc', { responseType: 'text' })

      expect(response).toMatchObject({ ok: true, data: '# Title' })
    })

    test('reads an ok body as a buffer, with its headers, when asked', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/image').reply(statusCodes.HTTP_STATUS_OK, Buffer.from([1, 2, 3]), { 'Content-Type': 'image/png' })

      const response = await client.request('/image', { responseType: 'buffer' })

      expect(Buffer.isBuffer(response.data)).toBe(true)
      expect([...response.data]).toEqual([1, 2, 3])
      expect(response.headers.get('content-type')).toBe('image/png')
    })

    test('repeats a query parameter given an array', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/items').query({ scheme: ['a', 'b'], limit: '5' }).reply(statusCodes.HTTP_STATUS_OK, {})

      await client.request('/items', { query: { scheme: ['a', 'b'], limit: 5, cursor: undefined } })
    })

    test('throws when an ok response has no valid JSON body', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/invalid').reply(statusCodes.HTTP_STATUS_OK, 'not json')

      await expect(client.request('/invalid')).rejects.toThrow(SyntaxError)
    })

    test('returns ok:false for a status in the expected list', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/missing').reply(statusCodes.HTTP_STATUS_NOT_FOUND, '', { 'content-type': 'text/plain' })

      const response = await client.request('/missing', { expected: [statusCodes.HTTP_STATUS_NOT_FOUND] })

      expect(response).toMatchObject({ ok: false, status: statusCodes.HTTP_STATUS_NOT_FOUND, data: null })
      expect(response.headers.get('content-type')).toBe('text/plain')
    })

    test('throws errorClass instance with status code for unexpected status', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/error').reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)

      await expect(client.request('/error')).rejects.toMatchObject({
        name: 'TestApiError',
        statusCode: statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR,
        message: 'API GET /error failed: 500'
      })
    })

    test('sends request body with json content-type header and query parameters', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, timeout: 5000, errorClass: TestApiError })

      nock(TEST_BASE_URL)
        .matchHeader('content-type', 'application/json')
        .post('/submit', { key: 'val' })
        .query({ flag: '1' })
        .reply(statusCodes.HTTP_STATUS_OK, { success: true })

      const response = await client.request('/submit', {
        method: 'POST',
        body: { key: 'val' },
        query: { flag: '1', unused: undefined }
      })

      expect(response.ok).toBe(true)
    })

    test('gives up on a response slower than the timeout', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, timeout: 10, errorClass: TestApiError })

      // nock's delay() only holds back the body, which ignores the abort
      // signal, so hold back the whole reply instead
      nock(TEST_BASE_URL).get('/slow').reply(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))

        return [statusCodes.HTTP_STATUS_OK, {}]
      })

      await expect(client.request('/slow')).rejects.toMatchObject({ name: 'TimeoutError' })
    })

    test('waits without limit when the request\'s timeout is null', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, timeout: 10, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/slow').delay(100).reply(statusCodes.HTTP_STATUS_OK, { done: true })

      const response = await client.request('/slow', { timeout: null })

      expect(response.data).toEqual({ done: true })
    })

    test('adds the auth headers to every request', async () => {
      const getAuthHeaders = async () => ({ Authorization: 'Bearer token-a' })
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError, getAuthHeaders })

      const scope = nock(TEST_BASE_URL, { reqheaders: { authorization: 'Bearer token-a' } })
        .get('/items')
        .reply(statusCodes.HTTP_STATUS_OK, {})

      await client.request('/items')

      expect(scope.isDone()).toBe(true)
    })

    test('lets a request\'s own headers override the auth headers', async () => {
      const getAuthHeaders = async () => ({ Authorization: 'Bearer token-a' })
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError, getAuthHeaders })

      const scope = nock(TEST_BASE_URL, { reqheaders: { authorization: 'Bearer token-b' } })
        .get('/items')
        .reply(statusCodes.HTTP_STATUS_OK, {})

      await client.request('/items', { headers: { Authorization: 'Bearer token-b' } })

      expect(scope.isDone()).toBe(true)
    })
  })
})
