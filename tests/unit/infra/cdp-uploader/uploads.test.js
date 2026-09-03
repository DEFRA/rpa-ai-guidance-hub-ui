import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { initiateUploadResponse, uploadStatusResponse } from '../../../fixtures/cdp-uploader.js'
import { initiateUpload, getUploadStatus } from '../../../../src/infra/cdp-uploader/uploads.js'
import { config } from '../../../../src/config/config.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')

beforeAll(() => {
  nock.disableNetConnect()
})

afterAll(() => {
  nock.enableNetConnect()
})

afterEach(() => {
  nock.cleanAll()
})

describe('cdp-uploader uploads API', () => {
  describe('initiateUpload', () => {
    test('POSTs the initiate request and returns the client response', async () => {
      const responseBody = initiateUploadResponse()

      nock(CDP_UPLOADER_URL)
        .post('/initiate', { redirect: '/create-guidance/metadata', s3Bucket: 'rpa-ai-guidance-hub-source-docs' })
        .reply(statusCodes.HTTP_STATUS_OK, responseBody)

      const response = await initiateUpload({
        redirect: '/create-guidance/metadata',
        s3Bucket: 'rpa-ai-guidance-hub-source-docs'
      })

      expect(response).toEqual({ ok: true, status: statusCodes.HTTP_STATUS_OK, data: responseBody })
    })
  })

  describe('getUploadStatus', () => {
    test('treats 404 as an expected status rather than throwing', async () => {
      nock(CDP_UPLOADER_URL).get('/status/u-1').reply(statusCodes.HTTP_STATUS_NOT_FOUND)

      const response = await getUploadStatus('u-1')

      expect(response).toEqual({ ok: false, status: statusCodes.HTTP_STATUS_NOT_FOUND, data: null })
    })

    test('adds debug=true to the query string when requested', async () => {
      // nock only matches a request whose query string is exactly {debug: 'true'} -
      // proving the flag reached the request without asserting on it directly
      nock(CDP_UPLOADER_URL)
        .get('/status/u-1')
        .query({ debug: 'true' })
        .reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse())

      const response = await getUploadStatus('u-1', { debug: true })

      expect(response.ok).toBe(true)
    })

    test('omits the query string when debug is not requested', async () => {
      nock(CDP_UPLOADER_URL).get('/status/u-1').reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse())

      const response = await getUploadStatus('u-1')

      expect(response.ok).toBe(true)
    })
  })
})
