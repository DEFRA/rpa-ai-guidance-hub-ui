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

      expect(response).toEqual({ ok: true, status: statusCodes.HTTP_STATUS_OK, data: { items: [1, 2] } })
    })

    test('throws when an ok response has no valid JSON body', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/invalid').reply(statusCodes.HTTP_STATUS_OK, 'not json')

      await expect(client.request('/invalid')).rejects.toThrow(SyntaxError)
    })

    test('returns ok:false for a status in the expected list', async () => {
      const client = new ApiClient({ baseUrl: TEST_BASE_URL, errorClass: TestApiError })

      nock(TEST_BASE_URL).get('/missing').reply(statusCodes.HTTP_STATUS_NOT_FOUND)

      const response = await client.request('/missing', { expected: [statusCodes.HTTP_STATUS_NOT_FOUND] })

      expect(response).toEqual({ ok: false, status: statusCodes.HTTP_STATUS_NOT_FOUND, data: null })
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
  })
})
