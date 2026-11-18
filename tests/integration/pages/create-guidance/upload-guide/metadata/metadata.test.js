import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { errorSummaryOf, pageOf, summaryValueOf } from '../../../../helpers/page.js'
import { config } from '../../../../../../src/config/config.js'
import { schemesResponse, stagedDocumentResponse } from '../../../../../fixtures/guidance-api.js'
import { initiateUploadResponse, uploadStatusResponse } from '../../../../../fixtures/cdp-uploader.js'
import { METADATA_MESSAGES } from '../../../../../fixtures/messages.js'

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
 * Drive a migration all the way to a captured fileId (scan clean, parse
 * complete), by following the same real processing flow that a
 * browser polling the processing page would - so the metadata page's own
 * draft fetch has a fileId to look up.
 */
async function completeParse (server, cookie, uploadId = 'u-metadata') {
  let sessionCookie = await startMigration(server, cookie, uploadId)

  nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).times(2).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

  const first = await server.inject({
    method: 'GET',
    url: PROCESSING_URL,
    headers: { cookie: sessionCookie }
  })

  expect(first.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
  sessionCookie = mergeCookies(sessionCookie, first.headers['set-cookie'])

  nock(GUIDANCE_API_BASE_URL).get('/guides/staging/file-1').once().reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete' }))

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
    await server?.stop({ timeout: 0 })
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

      const errors = errorSummaryOf(pageOf(response.payload))
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(errors.getByRole('heading', { name: 'There is a problem' })).toBeInTheDocument()
      expect(errors.getByRole('link', { name: METADATA_MESSAGES.titleRequired })).toBeInTheDocument()
    })

    test('POST /create-guidance/upload-guide/metadata normalizes "none" out and redirects when submitted alongside another scheme', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await startMigration(server, devCookie)

      mockSchemes()

      const response = await server.inject({
        method: 'POST',
        url: '/create-guidance/upload-guide/metadata',
        payload: { guideTitle: 'A valid title', versionNumber: '1.0', schemes: ['not-scheme-specific', 'sustainable-farming-incentive-sfi'] },
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/create-guidance/upload-guide/metadata/purpose')
    })

    test('GET /create-guidance/upload-guide/metadata loads the staged document title and last modified date once parsing has captured a fileId, and asks for the version number without filling it in', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeParse(server, devCookie)

      mockSchemes()
      nock(GUIDANCE_API_BASE_URL).get('/guides/staging/file-1').once().reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({
        parsingStatus: 'complete',
        title: 'Parsed Document Title',
        version: '2.0',
        lastModified: '2026-05-10T12:00:00.000Z'
      }))

      const response = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/metadata',
        headers: { cookie }
      })

      const page = pageOf(response.payload)
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.getByLabelText('Guidance title')).toHaveValue('Parsed Document Title')
      expect(summaryValueOf(page, 'Last modified date')).toHaveTextContent('10 May 2026')
      expect(page.getByLabelText('Version number')).toHaveAttribute('name', 'versionNumber')
      expect(page.getByLabelText('Version number')).not.toHaveValue()
      expect(page.document.querySelector('main')).not.toHaveTextContent('2.0')
    })

    test.each([
      ['', METADATA_MESSAGES.versionNumberRequired],
      ['1', METADATA_MESSAGES.versionNumberFormat]
    ])('POST /create-guidance/upload-guide/metadata re-renders 400 for the version number %j, keeping what was entered', async (versionNumber, message) => {
      const cookie = await loginAsDevUser(server)

      // one call to build the validation schema, one to re-render the form on failure
      mockSchemes()
      mockSchemes()

      const response = await server.inject({
        method: 'POST',
        url: '/create-guidance/upload-guide/metadata',
        payload: { guideTitle: 'A valid title', versionNumber, schemes: ['sustainable-farming-incentive-sfi'] },
        headers: { cookie }
      })

      const page = pageOf(response.payload)
      const field = page.getByLabelText('Version number')
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(errorSummaryOf(page).getByRole('link', { name: message })).toHaveAttribute('href', '#version-number')
      expect(field).toHaveAccessibleDescription(`For example, 1.0 Error: ${message}`)
      expect(field).toHaveAttribute('value', versionNumber)
    })

    test('GET /create-guidance/upload-guide/metadata shows the scheme year, 2026, chosen and fixed', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeParse(server, devCookie)
      mockSchemes()
      nock(GUIDANCE_API_BASE_URL).get('/guides/staging/file-1').once().reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete' }))

      const { payload } = await server.inject({ method: 'GET', url: '/create-guidance/upload-guide/metadata', headers: { cookie } })

      const page = pageOf(payload)
      const year = page.getByRole('radio', { name: '2026' })
      expect(page.getByRole('group', { name: 'Scheme year' })).toContainElement(year)
      expect(year).toHaveAttribute('name', 'schemeYear')
      expect(year).toBeChecked()
      expect(year).toBeDisabled()
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
