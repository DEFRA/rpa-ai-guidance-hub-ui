import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { initiateUploadResponse, uploadStatusResponse, rejectedFile } from '../../fixtures/cdp-uploader.js'
import { createServer } from '../../../src/server/server.js'
import { loginAsDevUser } from '../helpers/login.js'
import { mergeCookies } from '../helpers/cookies.js'
import { config } from '../../../src/config/config.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')

async function startMigration (server, cookie) {
  const uploadId = 'u-123'

  nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId }))

  const get = await server.inject({
    method: 'GET',
    url: '/create-guidance/upload-guide',
    headers: { cookie }
  })

  expect(get.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

  return { uploadId, cookie: mergeCookies(cookie, get.headers['set-cookie']) }
}

describe('#statusPollRouter', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  test('GET /status-poll/{uploadId} returns JSON status for in-progress upload', async () => {
    const cookie = await loginAsDevUser(server)
    nock(CDP_UPLOADER_URL).get('/status/u-123').reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

    const res = await server.inject({
      method: 'GET',
      url: '/status-poll/u-123',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)
    expect(json.uploadId).toBe('u-123')
    expect(json.uploadStatus).toBe('pending')
    expect(json.isReady).toBe(false)
    expect(json.redirectUrl).toBeNull()
  })

  test('GET /status-poll/{uploadId} returns JSON status with redirectUrl when ready and clean', async () => {
    const cookie = await loginAsDevUser(server)
    nock(CDP_UPLOADER_URL).get('/status/u-123').reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

    const res = await server.inject({
      method: 'GET',
      url: '/status-poll/u-123',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)
    expect(json.isReady).toBe(true)
    expect(json.redirectUrl).toBe('/create-guidance/metadata')
  })

  test('GET /status-poll without path param uses session upload id', async () => {
    const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

    nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

    const res = await server.inject({
      method: 'GET',
      url: '/status-poll',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)
    expect(json.uploadId).toBe(uploadId)
    expect(json.uploadStatus).toBe('pending')
  })

  test('GET /status-poll returns 400 when no session upload and no uploadId param', async () => {
    const cookie = await loginAsDevUser(server)

    const res = await server.inject({
      method: 'GET',
      url: '/status-poll',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
  })

  test('GET /status-poll/{uploadId} returns JSON status with null redirectUrl when files are rejected', async () => {
    const cookie = await loginAsDevUser(server)
    nock(CDP_UPLOADER_URL).get('/status/u-123').reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 1,
      form: {
        file: rejectedFile({ errorMessage: 'Virus found' })
      }
    }))

    const res = await server.inject({
      method: 'GET',
      url: '/status-poll/u-123',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)
    expect(json.hasRejectedFiles).toBe(true)
    expect(json.redirectUrl).toBeNull()
  })

  test('GET /status-poll/{uploadId} returns 404 when cdp-uploader returns 404', async () => {
    const cookie = await loginAsDevUser(server)
    nock(CDP_UPLOADER_URL).get('/status/unknown-id').reply(statusCodes.HTTP_STATUS_NOT_FOUND)

    const res = await server.inject({
      method: 'GET',
      url: '/status-poll/unknown-id',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
  })
})
