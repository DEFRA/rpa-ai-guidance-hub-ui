import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { initiateUploadResponse, rejectedFile, uploadStatusResponse } from '../../../../fixtures/cdp-uploader.js'
import { audiencesResponse, schemesResponse, stagedDocumentResponse, systemsResponse } from '../../../../fixtures/guidance-api.js'
import { createServer } from '../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'
import { mergeCookies } from '../../../helpers/cookies.js'
import { config } from '../../../../../src/config/config.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')
const START_OVER_URL = '/create-guidance/start-over'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const PROCESSING_URL = '/create-guidance/upload-guide/processing'

function mockReferenceData () {
  nock(GUIDANCE_API_URL).get('/reference/schemes').reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
  nock(GUIDANCE_API_URL).get('/reference/systems').reply(statusCodes.HTTP_STATUS_OK, systemsResponse())
  nock(GUIDANCE_API_URL).get('/reference/audiences').reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())
}

/**
 * Put an active upload in session by driving the real upload-initiation
 * flow, rather than poking session state directly.
 */
async function startMigration (server, cookie, uploadId = 'u-start-over') {
  nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId }))

  const get = await server.inject({ method: 'GET', url: UPLOAD_GUIDE_URL, headers: { cookie } })

  expect(get.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

  return { uploadId, cookie: mergeCookies(cookie, get.headers['set-cookie']) }
}

/**
 * Drive a migration all the way to a completed parse (scan clean, parse
 * complete) via the real processing flow, so the session has genuine
 * progress worth confirming before it's discarded.
 */
async function completeUpload (server, cookie, uploadId = 'u-start-over') {
  const started = await startMigration(server, cookie, uploadId)
  let sessionCookie = started.cookie

  nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).times(2).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

  const first = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie: sessionCookie } })
  sessionCookie = mergeCookies(sessionCookie, first.headers['set-cookie'])

  nock(GUIDANCE_API_URL).get('/guides/staging/file-1').once().reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete' }))

  const second = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie: sessionCookie } })
  expect(second.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)

  return { uploadId, cookie: mergeCookies(sessionCookie, second.headers['set-cookie']) }
}

describe('start-over', () => {
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

  describe(`GET ${START_OVER_URL}`, () => {
    test('requires a signed-in user', async () => {
      const res = await server.inject({ method: 'GET', url: START_OVER_URL })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(res.headers.location).toBe('/')
    })

    test('clears session and redirects immediately when there is no upload', async () => {
      const cookie = await loginAsDevUser(server)

      const res = await server.inject({ method: 'GET', url: START_OVER_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(res.headers.location).toBe(UPLOAD_GUIDE_URL)

      // Session was actually cleared, not just skipped past - the next visit
      // to the upload form starts a genuinely fresh upload.
      nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: 'u-fresh' }))
      const reload = await server.inject({
        method: 'GET',
        url: UPLOAD_GUIDE_URL,
        headers: { cookie: mergeCookies(cookie, res.headers['set-cookie']) }
      })

      expect(reload.payload).toContain('u-fresh')
      expect(nock.pendingMocks()).toEqual([])
    })

    test('clears session and redirects immediately when the upload was rejected', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
        uploadStatus: 'ready',
        numberOfRejectedFiles: 1,
        form: { file: rejectedFile() }
      }))

      const res = await server.inject({ method: 'GET', url: START_OVER_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(res.headers.location).toBe(UPLOAD_GUIDE_URL)
    })

    test('asks for confirmation instead of resetting once the upload has completed, showing what would be lost', async () => {
      const { uploadId, cookie } = await completeUpload(server, await loginAsDevUser(server))

      nock(GUIDANCE_API_URL).get('/guides/staging/file-1').reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({
        parsingStatus: 'complete',
        version: '1.4',
        lastModified: '2024-03-01T00:00:00.000Z'
      }))
      mockReferenceData()

      const res = await server.inject({ method: 'GET', url: START_OVER_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(res.payload).toContain('Are you sure you want to start over?')
      expect(res.payload).toContain('Version number')
      expect(res.payload).toContain('1.4')
      expect(nock.pendingMocks()).toEqual([])

      // Confirming this GET did not itself clear anything - the upload is
      // still there and still reported as complete.
      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))
      nock(GUIDANCE_API_URL).get('/guides/staging/file-1').reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete' }))

      const stillThere = await server.inject({ method: 'GET', url: UPLOAD_GUIDE_URL, headers: { cookie } })
      expect(stillThere.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(stillThere.headers.location).toBe('/create-guidance/upload-guide/metadata')
    })

    test('sends "cancel" back to the page the link was followed from', async () => {
      const { cookie } = await completeUpload(server, await loginAsDevUser(server))

      nock(GUIDANCE_API_URL).get('/guides/staging/file-1').reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete' }))
      mockReferenceData()

      const res = await server.inject({
        method: 'GET',
        url: `${START_OVER_URL}?returnUrl=%2Fcreate-guidance%2Fupload-guide%2Fmetadata`,
        headers: { cookie }
      })

      expect(res.payload).toContain('href="/create-guidance/upload-guide/metadata"')
    })
  })

  describe(`POST ${START_OVER_URL}`, () => {
    test('clears session and redirects to the upload form, starting fresh', async () => {
      const { cookie } = await completeUpload(server, await loginAsDevUser(server))

      const res = await server.inject({ method: 'POST', url: START_OVER_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(res.headers.location).toBe(UPLOAD_GUIDE_URL)

      nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: 'u-after-reset' }))
      const reload = await server.inject({
        method: 'GET',
        url: UPLOAD_GUIDE_URL,
        headers: { cookie: mergeCookies(cookie, res.headers['set-cookie']) }
      })

      expect(reload.payload).toContain('u-after-reset')
      expect(nock.pendingMocks()).toEqual([])
    })
  })
})
