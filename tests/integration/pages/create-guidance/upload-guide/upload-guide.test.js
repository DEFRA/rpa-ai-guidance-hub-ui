import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { initiateUploadResponse, uploadStatusResponse } from '../../../../fixtures/cdp-uploader.js'
import { createServer } from '../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'
import { mergeCookies } from '../../../helpers/cookies.js'
import { config } from '../../../../../src/config/config.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')

/**
 * Starts a migration via the action-type page, standing in for a real
 * cdp-uploader /initiate call, and returns the uploadId and the session
 * cookie carrying it - the yar session cookie isn't issued until this POST
 * first writes to session, so the caller's cookie won't yet include it.
 */
async function startMigration (server, cookie) {
  const uploadId = 'u-123'

  nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId }))

  const post = await server.inject({
    method: 'POST',
    url: '/create-guidance/action-type',
    payload: { action: 'migrate' },
    headers: { cookie }
  })

  expect(post.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
  expect(post.headers.location).toBe('/create-guidance/upload-guide')

  return { uploadId, cookie: mergeCookies(cookie, post.headers['set-cookie']) }
}

describe('#uploadGuideController', () => {
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

  test('GET /create-guidance/upload-guide when no migration started redirects to action-type', async () => {
    const cookie = await loginAsDevUser(server)

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide',
      headers: { cookie }
    })

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(headers.location).toBe('/create-guidance/action-type')
  })

  describe('once a migration has been started', () => {
    test('renders the upload page while the upload is still in progress', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'initiated' }))

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Upload guidance')
    })

    test('redirects to add-metadata once the upload has already been used', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/create-guidance/add-metadata')
    })
  })
})
