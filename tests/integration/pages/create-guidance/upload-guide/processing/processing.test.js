import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import {
  initiateUploadResponse,
  uploadStatusResponse,
  rejectedFile
} from '../../../../../fixtures/cdp-uploader.js'

import { createServer } from '../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { config } from '../../../../../../src/config/config.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')

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

async function startMigration (server, cookie) {
  const uploadId = 'u-123'

  nock(CDP_UPLOADER_URL)
    .post('/initiate')
    .reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId }))

  const get = await server.inject({
    method: 'GET',
    url: '/create-guidance/upload-guide',
    headers: { cookie }
  })

  expect(get.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

  return { uploadId, cookie: mergeCookies(cookie, get.headers['set-cookie']) }
}

describe('upload guide processing page integration', () => {
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

  test('redirects to the upload form when no session upload exists', async () => {
    const cookie = await loginAsDevUser(server)

    const res = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide/processing',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(res.headers.location).toBe('/create-guidance/upload-guide')
  })

  test('renders the "Checking your file" panel with initial progress', async () => {
    const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

    nock(CDP_UPLOADER_URL)
      .get(`/status/${uploadId}`)
      .reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
        uploadStatus: 'pending'
      }))

    const res = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide/processing',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(res.payload).toContain('Checking your file')
    expect(res.payload).toContain('data-poll-url="/status-poll/u-123"')
    expect(res.payload).toContain('data-redirect-url="/create-guidance/metadata"')
    expect(res.payload).toContain('app-progress__bar')
  })

  test('redirects back to upload form when upload has not progressed beyond initiated', async () => {
    const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

    nock(CDP_UPLOADER_URL)
      .get(`/status/${uploadId}`)
      .reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
        uploadStatus: 'initiated'
      }))

    const res = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide/processing',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(res.headers.location).toBe('/create-guidance/upload-guide')
  })

  test('renders the panel when the upload has rejected files', async () => {
    const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

    nock(CDP_UPLOADER_URL)
      .persist()
      .get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
        uploadStatus: 'ready',
        numberOfRejectedFiles: 1,
        form: {
          file: rejectedFile({ errorMessage: 'The file contains a virus' })
        }
      }))

    await consumeInitialStatus(server, uploadId, cookie)

    const res = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide/processing',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(res.payload).toContain('Scan failed')
  })
})
