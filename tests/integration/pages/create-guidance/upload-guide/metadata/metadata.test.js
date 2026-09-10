import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { config } from '../../../../../../src/config/config.js'
import { schemesResponse } from '../../../../../fixtures/guidance-api.js'
import { initiateUploadResponse } from '../../../../../fixtures/cdp-uploader.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')

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
