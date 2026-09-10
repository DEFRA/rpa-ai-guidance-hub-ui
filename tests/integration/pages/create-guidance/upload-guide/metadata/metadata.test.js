import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { config } from '../../../../../../src/config/config.js'
import { schemesResponse, draftResponse } from '../../../../../fixtures/guidance-api.js'
import { initiateUploadResponse, uploadStatusResponse } from '../../../../../fixtures/cdp-uploader.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const PROCESSING_URL = '/create-guidance/upload-guide/processing'

function mockSchemes () {
  nock(GUIDANCE_API_BASE_URL).get('/reference/schemes').reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
}

/**
 * Put an active upload in session, as the metadata routes require one, by
 * driving the real upload-initiation flow rather than poking session state
 * directly.
 */
async function startMigration (server, cookie, uploadId = 'u-metadata') {
  nock(CDP_UPLOADER_URL)
    .post('/initiate')
    .reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId }))

  const get = await server.inject({
    method: 'GET',
    url: '/create-guidance/upload-guide',
    headers: { cookie }
  })

  expect(get.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

  return mergeCookies(cookie, get.headers['set-cookie'])
}

/**
 * Drive a migration all the way to a captured fileId (scan clean, minimal
 * parse complete), by following the same real processing flow that a
 * browser polling the processing page would - so the metadata page's own
 * draft fetch has a fileId to look up.
 */
async function completeMinimalParse (server, cookie, uploadId = 'u-metadata') {
  let sessionCookie = await startMigration(server, cookie, uploadId)

  nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).times(2).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

  const first = await server.inject({
    method: 'GET',
    url: PROCESSING_URL,
    headers: { cookie: sessionCookie }
  })

  expect(first.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
  sessionCookie = mergeCookies(sessionCookie, first.headers['set-cookie'])

  nock(GUIDANCE_API_BASE_URL).get('/guidance/drafts/file-1').once().reply(statusCodes.HTTP_STATUS_OK, draftResponse({ parsingStatus: 'complete' }))

  const second = await server.inject({
    method: 'GET',
    url: PROCESSING_URL,
    headers: { cookie: sessionCookie }
  })

  expect(second.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
  expect(second.headers.location).toBe('/create-guidance/upload-guide/metadata')

  return mergeCookies(sessionCookie, second.headers['set-cookie'])
}

describe('#metadataController Integration', () => {
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

  describe('When logged in as a dev user', () => {
    test('GET /create-guidance/upload-guide/metadata redirects to /create-guidance/upload-guide if no session upload', async () => {
      const cookie = await loginAsDevUser(server)

      const response = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/metadata',
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/create-guidance/upload-guide')
    })

    test('POST /create-guidance/upload-guide/metadata re-renders 400 with errors for empty title or scheme', async () => {
      const cookie = await loginAsDevUser(server)

      // one call to build the validation schema, one to re-render the form on failure
      mockSchemes()
      mockSchemes()

      const response = await server.inject({
        method: 'POST',
        url: '/create-guidance/upload-guide/metadata',
        payload: { guideTitle: '', scheme: '' },
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(response.payload).toContain('There is a problem')
      expect(response.payload).toContain('Enter the guidance title')
    })

    test('POST /create-guidance/upload-guide/metadata normalizes "none" out and redirects when submitted alongside another scheme', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await startMigration(server, devCookie)

      mockSchemes()

      const response = await server.inject({
        method: 'POST',
        url: '/create-guidance/upload-guide/metadata',
        payload: { guideTitle: 'A valid title', schemes: ['none', 'sfi'] },
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/create-guidance/upload-guide/metadata/purpose')
    })

    test('GET /create-guidance/upload-guide/metadata loads the draft title, version and last modified date once minimal parse has captured a fileId', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeMinimalParse(server, devCookie)

      mockSchemes()
      nock(GUIDANCE_API_BASE_URL).get('/guidance/drafts/file-1').once().reply(statusCodes.HTTP_STATUS_OK, draftResponse({
        parsingStatus: 'complete',
        title: 'Parsed Draft Title',
        version: '2.0',
        lastModified: '2026-05-10T12:00:00.000Z'
      }))

      const response = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/metadata',
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(response.payload).toContain('value="Parsed Draft Title"')
      expect(response.payload).toContain('2.0')
      expect(response.payload).toContain('10 May 2026')
    })
  })

  describe('When not logged in', () => {
    test('GET /create-guidance/upload-guide/metadata redirects to /', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/metadata'
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/')
    })
  })
})
