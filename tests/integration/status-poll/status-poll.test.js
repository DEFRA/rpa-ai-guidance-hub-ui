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

/**
 * The very first poll for an upload always reports the synthetic 'initial'
 * status without checking anything downstream (see src/pages/create-guidance/service.js).
 * Tests that want to assert on a real downstream status poll once first to
 * consume 'initial', carrying forward the session cookie it persists to.
 */
async function consumeInitialStatus (server, uploadId, cookie) {
  const res = await server.inject({
    method: 'GET',
    url: `/status-poll/${uploadId}`,
    headers: { cookie }
  })

  return mergeCookies(cookie, res.headers['set-cookie'])
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

  test('GET /status-poll/{uploadId} returns the initial status on the very first poll, without checking anything', async () => {
    const cookie = await loginAsDevUser(server)

    const res = await server.inject({
      method: 'GET',
      url: '/status-poll/u-123',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)
    expect(json.percentage).toBe(25)
    expect(json.label).toBe('Checking your file')
    expect(json.isComplete).toBe(false)
    expect(json.isError).toBe(false)
  })

  test('GET /status-poll/{uploadId} returns JSON status for in-progress upload', async () => {
    const { uploadId, cookie: migrationCookie } = await startMigration(server, await loginAsDevUser(server))
    const cookie = await consumeInitialStatus(server, uploadId, migrationCookie)

    nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

    const res = await server.inject({
      method: 'GET',
      url: `/status-poll/${uploadId}`,
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)
    expect(json.percentage).toBe(50)
    expect(json.label).toBe('Scanning for viruses')
    expect(json.isComplete).toBe(false)
    expect(json.isError).toBe(false)
  })

  test('GET /status-poll/{uploadId} returns JSON status when ready', async () => {
    const { uploadId, cookie: migrationCookie } = await startMigration(server, await loginAsDevUser(server))
    const cookie = await consumeInitialStatus(server, uploadId, migrationCookie)

    nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

    const res = await server.inject({
      method: 'GET',
      url: `/status-poll/${uploadId}`,
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)
    expect(json.isComplete).toBe(true)
    expect(json.percentage).toBe(100)
    expect(json.label).toBe('File scanned successfully')
  })

  test('GET /status-poll without path param uses session upload id', async () => {
    const { uploadId, cookie: migrationCookie } = await startMigration(server, await loginAsDevUser(server))
    const cookie = await consumeInitialStatus(server, uploadId, migrationCookie)

    nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

    const res = await server.inject({
      method: 'GET',
      url: '/status-poll',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)
    expect(json.percentage).toBe(50)
    expect(json.label).toBe('Scanning for viruses')
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

  test('GET /status-poll/{uploadId} returns error state when files are rejected', async () => {
    const { uploadId, cookie: migrationCookie } = await startMigration(server, await loginAsDevUser(server))
    const cookie = await consumeInitialStatus(server, uploadId, migrationCookie)

    nock(CDP_UPLOADER_URL)
      .persist()
      .get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
        uploadStatus: 'ready',
        numberOfRejectedFiles: 1,
        form: {
          file: rejectedFile({ errorMessage: 'Virus found' })
        }
      }))

    const res = await server.inject({
      method: 'GET',
      url: `/status-poll/${uploadId}`,
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    const json = JSON.parse(res.payload)

    expect(json.isError).toBe(true)
  })
})
