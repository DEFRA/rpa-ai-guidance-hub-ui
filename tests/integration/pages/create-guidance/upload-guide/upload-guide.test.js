import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { initiateUploadResponse, rejectedFile, uploadStatusResponse } from '../../../../fixtures/cdp-uploader.js'
import { draftResponse } from '../../../../fixtures/guidance-api.js'
import { createServer } from '../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'
import { mergeCookies } from '../../../helpers/cookies.js'
import { config } from '../../../../../src/config/config.js'
import * as referenceDataService from '../../../../../src/services/reference-data.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')

/**
 * Starts a migration by hitting the upload-guide page for the first time,
 * standing in for a real cdp-uploader /initiate call, and returns the
 * uploadId and the session cookie carrying it - the yar session cookie
 * isn't issued until this GET first writes to session, so the caller's
 * cookie won't yet include it.
 */
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
    vi.restoreAllMocks()
  })

  test('GET /create-guidance/upload-guide when no migration started initiates one and renders the upload form', async () => {
    const cookie = await loginAsDevUser(server)

    nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: 'u-123' }))

    const { statusCode, payload } = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide',
      headers: { cookie }
    })

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(payload).toContain('Upload guidance')
  })

  describe('once a migration has been started', () => {
    test('renders the upload page while the upload form has not been submitted', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'initiated' }))

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Upload guidance')
      expect(payload).toContain(`/upload-and-scan/${uploadId}`)
    })

    test('redirects to the processing page while the upload is still being scanned', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/create-guidance/upload-guide/processing')
    })

    test('starts a fresh upload when the previous file was rejected', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
        uploadStatus: 'ready',
        numberOfRejectedFiles: 1,
        form: { file: rejectedFile() }
      }))
      nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: 'u-456' }))

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('/upload-and-scan/u-456')
      expect(payload).not.toContain(`/upload-and-scan/${uploadId}`)
    })

    test('redirects to metadata once the upload has scanned clean and parsing is complete', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).persist().get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))
      nock(GUIDANCE_API_URL).persist().get('/guidance/drafts/file-1').reply(statusCodes.HTTP_STATUS_OK, draftResponse({ parsingStatus: 'complete' }))

      // Scanning is already done, but parsing hasn't been checked on a poll of
      // its own yet, so the user is sent to the processing page rather than
      // straight to metadata.
      const first = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie }
      })

      expect(first.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(first.headers.location).toBe('/create-guidance/upload-guide/processing')

      const cookieAfterFirst = mergeCookies(cookie, first.headers['set-cookie'])

      // A poll of the processing status endpoint actually checks (and completes) parsing.
      const poll = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/processing/status',
        headers: { cookie: cookieAfterFirst }
      })

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie: mergeCookies(cookieAfterFirst, poll.headers['set-cookie']) }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/create-guidance/upload-guide/metadata')

      nock.cleanAll()
    })

    test('shows a notification on the metadata page explaining why, once only', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).persist().get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))
      nock(GUIDANCE_API_URL).persist().get('/guidance/drafts/file-1').reply(statusCodes.HTTP_STATUS_OK, draftResponse({ parsingStatus: 'complete' }))
      vi.spyOn(referenceDataService, 'getSchemes').mockResolvedValue([
        { value: 'sfi', label: 'Sustainable Farming Incentive (SFI)' }
      ])

      const initial = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie }
      })

      const cookieAfterInitial = mergeCookies(cookie, initial.headers['set-cookie'])

      // Poll the processing status endpoint so parsing actually gets checked and completes.
      const poll = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/processing/status',
        headers: { cookie: cookieAfterInitial }
      })

      const readyCookie = mergeCookies(cookieAfterInitial, poll.headers['set-cookie'])

      await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie: readyCookie }
      })

      const first = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/metadata',
        headers: { cookie: readyCookie }
      })

      expect(first.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(first.payload).toContain('You have already uploaded a document for this guide')

      const second = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/metadata',
        headers: { cookie: mergeCookies(readyCookie, first.headers['set-cookie']) }
      })

      expect(second.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(second.payload).not.toContain('You have already uploaded a document for this guide')

      nock.cleanAll()
    })
  })
})
