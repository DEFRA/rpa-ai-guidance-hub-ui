import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import {
  initiateUploadResponse,
  uploadStatusResponse,
  rejectedFile
} from '../../../../../fixtures/cdp-uploader.js'
import { stagedDocumentResponse } from '../../../../../fixtures/guidance-api.js'

import { createServer } from '../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { config } from '../../../../../../src/config/config.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')
const PROCESSING_URL = '/create-guidance/upload-guide/processing'
const STATUS_URL = '/create-guidance/upload-guide/processing/status'

async function startMigration (server, cookie, uploadId = 'u-123') {
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

function rejectedStatus () {
  return uploadStatusResponse({
    uploadStatus: 'ready',
    numberOfRejectedFiles: 1,
    form: {
      file: rejectedFile({ errorMessage: 'The selected file contains a virus' })
    }
  })
}

describe('upload guide processing page', () => {
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

  describe(`GET ${PROCESSING_URL}`, () => {
    test('redirects to the upload form when no session upload exists', async () => {
      const cookie = await loginAsDevUser(server)

      const res = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(res.headers.location).toBe('/create-guidance/upload-guide')
    })

    test('redirects back to the upload form when the upload has not progressed beyond initiated', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'initiated' }))

      const res = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(res.headers.location).toBe('/create-guidance/upload-guide')
    })

    test('renders the scanning panel, with one cdp-uploader call, while the scan is pending', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      const scope = nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

      const res = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(res.payload).toContain('Document upload')
      expect(res.payload).toContain('Scanning for viruses')
      expect(res.payload).toContain(`data-poll-url="${STATUS_URL}"`)
      expect(res.payload).toContain('data-redirect-url="/create-guidance/upload-guide/metadata"')
      expect(res.payload).toContain('data-percentage="50"')
      expect(res.payload).toContain('style="width')
      expect(scope.isDone()).toBe(true)
      expect(nock.pendingMocks()).toEqual([])
    })

    test('shows the parsing stage once scanning is clean, then redirects to metadata once parsing completes', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).times(2).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

      const first = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(first.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(first.payload).toContain('Parsing document')

      nock(GUIDANCE_API_URL).get('/guides/staging/file-1').once().reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete' }))

      const second = await server.inject({
        method: 'GET',
        url: PROCESSING_URL,
        headers: { cookie: mergeCookies(cookie, first.headers['set-cookie']) }
      })

      expect(second.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(second.headers.location).toBe('/create-guidance/upload-guide/metadata')
      expect(nock.pendingMocks()).toEqual([])
    })

    test('shows cdp-uploader\'s reason and a way to try again when the file was rejected', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, rejectedStatus())

      const res = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(res.payload).toContain('There is a problem')
      expect(res.payload).toContain('The selected file contains a virus')
      expect(res.payload).toContain('File rejected')
      expect(res.payload).toContain('Start over')
      expect(res.payload).toContain('<title>')
      expect(res.payload).toContain('Error: Document upload')
      expect(res.payload).not.toContain('http-equiv="refresh"')
    })

    test('explains a validation failure, and retrying starts a genuinely fresh upload', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).times(2).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

      const first = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(first.payload).toContain('Parsing document')

      nock(GUIDANCE_API_URL).get('/guides/staging/file-1').reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'failed', parsingError: 'Not a Word document' }))

      const failedCookie = mergeCookies(cookie, first.headers['set-cookie'])
      const second = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie: failedCookie } })

      expect(second.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(second.payload).toContain('This file cannot be opened')
      expect(second.payload).toContain('Check you selected the correct file and that it has not been corrupted')
      expect(second.payload).toContain('Start over')

      // cdp-uploader still reports this file as scanned clean - only the
      // guidance API knows it failed - so both have to be checked before the
      // retry link is allowed to reuse the same dead upload.
      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))
      nock(GUIDANCE_API_URL).get('/guides/staging/file-1').reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'failed', parsingError: 'Not a Word document' }))
      nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: 'u-fresh' }))

      const retryCookie = mergeCookies(failedCookie, second.headers['set-cookie'])
      const retry = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide',
        headers: { cookie: retryCookie }
      })

      expect(retry.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(retry.payload).toContain('u-fresh')
      expect(retry.payload).not.toContain('This file cannot be opened')
      expect(nock.pendingMocks()).toEqual([])
    })

    test('treats a submission with no file as a failure, not a success', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready', form: {}, numberOfRejectedFiles: 0 }))

      const res = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(res.payload).toContain('Select a Word document to upload.')
    })

    test('explains when cdp-uploader no longer knows the upload', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_NOT_FOUND)

      const res = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(res.payload).toContain('Upload not found')
      expect(res.payload).toContain('Your upload could not be found. Upload the document again.')
    })
  })

  describe(`GET ${STATUS_URL}`, () => {
    test('requires a signed-in user', async () => {
      const res = await server.inject({ method: 'GET', url: STATUS_URL })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(res.headers.location).toBe('/')
    })

    test('returns 400 when the session has no upload', async () => {
      const cookie = await loginAsDevUser(server)

      const res = await server.inject({ method: 'GET', url: STATUS_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('returns JSON status for an in-progress upload', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

      const res = await server.inject({ method: 'GET', url: STATUS_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(JSON.parse(res.payload)).toEqual({
        percentage: 50,
        label: 'Scanning for viruses',
        message: null,
        detail: null,
        isComplete: false,
        isError: false
      })
    })

    test('reports parsing in progress once scanning completes, then complete once parsing does too - each on its own poll', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).once().reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

      const first = await server.inject({ method: 'GET', url: STATUS_URL, headers: { cookie } })

      expect(JSON.parse(first.payload)).toMatchObject({ isComplete: false, label: 'Parsing document' })

      nock(GUIDANCE_API_URL).get('/guides/staging/file-1').once().reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete' }))

      const second = await server.inject({
        method: 'GET',
        url: STATUS_URL,
        headers: { cookie: mergeCookies(cookie, first.headers['set-cookie']) }
      })

      expect(JSON.parse(second.payload)).toMatchObject({ isComplete: true, percentage: 100 })

      const third = await server.inject({
        method: 'GET',
        url: STATUS_URL,
        headers: { cookie: mergeCookies(cookie, second.headers['set-cookie']) }
      })

      expect(JSON.parse(third.payload)).toMatchObject({ isComplete: true })
      expect(nock.pendingMocks()).toEqual([])
    })

    test('returns the error state and cdp-uploader\'s message when the file was rejected', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, rejectedStatus())

      const res = await server.inject({ method: 'GET', url: STATUS_URL, headers: { cookie } })

      expect(JSON.parse(res.payload)).toEqual({
        percentage: 50,
        label: 'File rejected',
        message: 'The selected file contains a virus',
        detail: null,
        isComplete: false,
        isError: true
      })
    })

    test('only ever reports the session\'s own upload - an id in the URL is ignored', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

      const res = await server.inject({ method: 'GET', url: `${STATUS_URL}?uploadId=someone-elses`, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(JSON.parse(res.payload).label).toBe('Scanning for viruses')
      expect(nock.pendingMocks()).toEqual([])
    })

    test('a rejected upload stays failed on reload - only starting over clears it', async () => {
      const first = await startMigration(server, await loginAsDevUser(server), 'u-rejected')

      nock(CDP_UPLOADER_URL).get('/status/u-rejected').reply(statusCodes.HTTP_STATUS_OK, rejectedStatus())

      const failed = await server.inject({ method: 'GET', url: STATUS_URL, headers: { cookie: first.cookie } })
      expect(JSON.parse(failed.payload).isError).toBe(true)

      const cookie = mergeCookies(first.cookie, failed.headers['set-cookie'])

      // Reloading the upload form reports the same rejection rather than
      // silently starting a fresh upload - no /initiate mock is set up, so
      // any attempt to reinitiate would fail the test via unmatched nock.
      nock(CDP_UPLOADER_URL).get('/status/u-rejected').reply(statusCodes.HTTP_STATUS_OK, rejectedStatus())

      const reload = await server.inject({ method: 'GET', url: '/create-guidance/upload-guide', headers: { cookie } })

      expect(reload.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(reload.payload).toContain('u-rejected')
      expect(nock.pendingMocks()).toEqual([])
    })
  })
})
