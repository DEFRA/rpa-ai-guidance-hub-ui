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
      expect(res.payload).toContain('Checking your file')
      expect(res.payload).toContain('Scanning for viruses')
      expect(res.payload).toContain(`data-poll-url="${STATUS_URL}"`)
      expect(res.payload).toContain('data-redirect-url="/create-guidance/metadata"')
      expect(res.payload).toContain('data-percentage="50"')
      expect(res.payload).toContain('<meta http-equiv="refresh" content="5">')
      expect(res.payload).not.toContain('style="width')
      expect(scope.isDone()).toBe(true)
      expect(nock.pendingMocks()).toEqual([])
    })

    test('redirects straight to metadata when the file has already scanned clean', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

      const res = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(res.headers.location).toBe('/create-guidance/metadata')
    })

    test('shows cdp-uploader\'s reason and a way to try again when the file was rejected', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, rejectedStatus())

      const res = await server.inject({ method: 'GET', url: PROCESSING_URL, headers: { cookie } })

      expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(res.payload).toContain('There is a problem')
      expect(res.payload).toContain('The selected file contains a virus')
      expect(res.payload).toContain('File rejected')
      expect(res.payload).toContain('Upload a different file')
      expect(res.payload).toContain('<title>')
      expect(res.payload).toContain('Error: Checking your file')
      expect(res.payload).not.toContain('http-equiv="refresh"')
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
        isComplete: false,
        isError: false
      })
    })

    test('returns complete once the file has scanned clean, and stops calling cdp-uploader', async () => {
      const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

      nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).once().reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

      const first = await server.inject({ method: 'GET', url: STATUS_URL, headers: { cookie } })

      expect(JSON.parse(first.payload)).toMatchObject({ isComplete: true, percentage: 100, label: 'File scanned successfully' })

      const second = await server.inject({
        method: 'GET',
        url: STATUS_URL,
        headers: { cookie: mergeCookies(cookie, first.headers['set-cookie']) }
      })

      expect(JSON.parse(second.payload)).toMatchObject({ isComplete: true })
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

    test('a rejected upload does not inherit progress from a later retry', async () => {
      const first = await startMigration(server, await loginAsDevUser(server), 'u-rejected')

      nock(CDP_UPLOADER_URL).get('/status/u-rejected').reply(statusCodes.HTTP_STATUS_OK, rejectedStatus())

      const failed = await server.inject({ method: 'GET', url: STATUS_URL, headers: { cookie: first.cookie } })
      expect(JSON.parse(failed.payload).isError).toBe(true)

      // Returning to the upload form after a rejection starts a fresh upload
      nock(CDP_UPLOADER_URL).get('/status/u-rejected').reply(statusCodes.HTTP_STATUS_OK, rejectedStatus())
      const retry = await startMigration(server, mergeCookies(first.cookie, failed.headers['set-cookie']), 'u-retry')

      nock(CDP_UPLOADER_URL).get('/status/u-retry').reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

      const res = await server.inject({ method: 'GET', url: STATUS_URL, headers: { cookie: retry.cookie } })

      expect(JSON.parse(res.payload)).toMatchObject({ isComplete: false, isError: false, label: 'Scanning for viruses' })
    })
  })
})
