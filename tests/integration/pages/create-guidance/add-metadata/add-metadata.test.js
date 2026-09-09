import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { completeFile, initiateUploadResponse, uploadStatusResponse } from '../../../../fixtures/cdp-uploader.js'
import { createServer } from '../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'
import { mergeCookies } from '../../../helpers/cookies.js'
import { config } from '../../../../../src/config/config.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')
const UPLOAD_ID = 'u-123'
const SOURCE = 's3://rpa-ai-guidance-hub-source-docs/up-1/guide.docx'

/**
 * Put an upload in session, as the upload-guide page does, and answer the
 * cookie carrying it - the yar session cookie isn't issued until that GET
 * first writes to session.
 */
async function withUploadInSession (server) {
  const cookie = await loginAsDevUser(server)

  nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: UPLOAD_ID }))

  const get = await server.inject({
    method: 'GET',
    url: '/create-guidance/upload-guide',
    headers: { cookie }
  })

  return mergeCookies(cookie, get.headers['set-cookie'])
}

/**
 * The uploader reporting a delivered file, which is where the API is told the
 * document is.
 */
function uploaderReportsADeliveredFile () {
  nock(CDP_UPLOADER_URL)
    .get(`/status/${UPLOAD_ID}`)
    .reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
      uploadStatus: 'ready',
      form: { guidanceDocument: completeFile() }
    }))
}

function validFormPayload (overrides = {}) {
  return {
    guidanceType: 'process',
    title: 'Submit your claim',
    intendedAudience: 'RPA caseworkers',
    intendedOutcome: 'Complete and submit the claim accurately',
    userPrerequisites: 'Understand claim eligibility criteria',
    requiresSystemAccess: 'no',
    systemAccessDetails: '',
    ...overrides
  }
}

describe('#addMetadataController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('When logged in as a dev user', () => {
    test('GET /create-guidance/metadata renders the metadata form', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/create-guidance/metadata',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Capture guidance metadata')
      expect(payload).toContain('Type of guidance')
    })

    test('POST /create-guidance/metadata re-renders with errors for invalid form data', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'POST',
        url: '/create-guidance/metadata',
        payload: {},
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('There is a problem')
      expect(payload).toContain('Select the type of guidance')
    })

    test('POST /create-guidance/metadata requires conditional system access details', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'POST',
        url: '/create-guidance/metadata',
        payload: validFormPayload({
          requiresSystemAccess: 'yes',
          systemAccessDetails: ''
        }),
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('Enter which systems users need access to')
    })

    test('POST /create-guidance/metadata captures the guide and redirects to the dashboard', async () => {
      const cookie = await withUploadInSession(server)
      uploaderReportsADeliveredFile()

      const captured = nock(GUIDANCE_API_URL)
        .post('/guides')
        .reply(statusCodes.HTTP_STATUS_CREATED, { id: 'g-1', content: 's3://managed/g-1/content.md', assets: 's3://assets/g-1' })

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/create-guidance/metadata',
        payload: validFormPayload({
          requiresSystemAccess: 'yes',
          systemAccessDetails: 'Rural Payments service'
        }),
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/designer/dashboard')
      expect(captured.isDone()).toBe(true)
    })

    test('POST /create-guidance/metadata tells the API where the document is', async () => {
      const cookie = await withUploadInSession(server)
      uploaderReportsADeliveredFile()

      let sent
      nock(GUIDANCE_API_URL)
        .post('/guides', (body) => {
          sent = body
          return true
        })
        .reply(statusCodes.HTTP_STATUS_CREATED, { id: 'g-1', content: 'c', assets: 'a' })

      await server.inject({
        method: 'POST',
        url: '/create-guidance/metadata',
        payload: validFormPayload(),
        headers: { cookie }
      })

      expect(sent.source).toEqual({
        uploadId: UPLOAD_ID,
        url: SOURCE,
        filename: 'guide.docx'
      })
      expect(sent.metadata.title).toBe('Submit your claim')
    })

    test('POST /create-guidance/metadata tells the API who was signed in', async () => {
      // The identity that made this version, which is not who owns the document:
      // owners are metadata an author supplies and may be a team. The id is the
      // one field that survives a rename, so it is what the API records.
      const cookie = await withUploadInSession(server)
      uploaderReportsADeliveredFile()

      let sent
      nock(GUIDANCE_API_URL)
        .post('/guides', (body) => {
          sent = body
          return true
        })
        .reply(statusCodes.HTTP_STATUS_CREATED, { id: 'g-1', versions: [] })

      await server.inject({
        method: 'POST',
        url: '/create-guidance/metadata',
        payload: validFormPayload(),
        headers: { cookie }
      })

      expect(sent.createdBy).toEqual({ id: 'dev-user-123', displayName: 'Dev User' })
    })

    test('POST /create-guidance/metadata with no upload in session sends the user back to upload one', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/create-guidance/metadata',
        payload: validFormPayload(),
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/create-guidance/upload-guide')
    })

    test('POST /create-guidance/metadata re-renders when the guide cannot be captured', async () => {
      const cookie = await withUploadInSession(server)
      uploaderReportsADeliveredFile()

      nock(GUIDANCE_API_URL).post('/guides').reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)

      const { statusCode, payload } = await server.inject({
        method: 'POST',
        url: '/create-guidance/metadata',
        payload: validFormPayload(),
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)
      expect(payload).toContain('The guidance could not be saved')
    })
  })

  describe('When not logged in', () => {
    test('GET /create-guidance/metadata redirects to the home page', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/create-guidance/metadata'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')
    })
  })
})
