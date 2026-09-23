import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../../helpers/login.js'
import { mergeCookies } from '../../../../../helpers/cookies.js'
import { config } from '../../../../../../../src/config/config.js'
import {
  audiencesResponse,
  schemesResponse,
  stagedDocumentResponse,
  systemsResponse
} from '../../../../../../fixtures/guidance-api.js'
import {
  initiateUploadResponse,
  uploadStatusResponse
} from '../../../../../../fixtures/cdp-uploader.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const PROCESSING_URL = '/create-guidance/upload-guide/processing'
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'

function mockReferenceData () {
  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/schemes')
    .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/systems')
    .reply(statusCodes.HTTP_STATUS_OK, systemsResponse())

  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/audiences')
    .reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())
}

async function startMigration (server, cookie, uploadId = 'u-check') {
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

async function completeParse (server, cookie, uploadId = 'u-check') {
  let sessionCookie = await startMigration(server, cookie, uploadId)

  nock(CDP_UPLOADER_URL)
    .get(`/status/${uploadId}`)
    .times(2)
    .reply(
      statusCodes.HTTP_STATUS_OK,
      uploadStatusResponse({ uploadStatus: 'ready' })
    )

  const first = await server.inject({
    method: 'GET',
    url: PROCESSING_URL,
    headers: { cookie: sessionCookie }
  })

  expect(first.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
  sessionCookie = mergeCookies(sessionCookie, first.headers['set-cookie'])

  nock(GUIDANCE_API_BASE_URL)
    .get('/guides/staging/file-1')
    .once()
    .reply(
      statusCodes.HTTP_STATUS_OK,
      stagedDocumentResponse({ parsingStatus: 'complete' })
    )

  const second = await server.inject({
    method: 'GET',
    url: PROCESSING_URL,
    headers: { cookie: sessionCookie }
  })

  expect(second.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)

  return mergeCookies(sessionCookie, second.headers['set-cookie'])
}

async function completeAllMetadata (server, cookie) {
  let sessionCookie = await completeParse(server, cookie)

  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/schemes')
    .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

  const guideDetailsResponse = await server.inject({
    method: 'POST',
    url: '/create-guidance/upload-guide/metadata',
    payload: { guideTitle: 'Complete Guide Title', schemes: ['sfi'] },
    headers: { cookie: sessionCookie }
  })

  expect(guideDetailsResponse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
  sessionCookie = mergeCookies(
    sessionCookie,
    guideDetailsResponse.headers['set-cookie']
  )

  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/systems')
    .reply(statusCodes.HTTP_STATUS_OK, systemsResponse())
  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/audiences')
    .reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())

  const purposeResponse = await server.inject({
    method: 'POST',
    url: '/create-guidance/upload-guide/metadata/purpose',
    payload: {
      owner: 'designer@example.com',
      goal: 'Clear guidance purpose',
      requirements: 'Standard training required',
      systems: ['crm'],
      audience: ['processor']
    },
    headers: { cookie: sessionCookie }
  })

  expect(purposeResponse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
  expect(purposeResponse.headers.location).toBe(CHECK_ANSWERS_URL)
  return mergeCookies(sessionCookie, purposeResponse.headers['set-cookie'])
}

describe('#checkAnswersController Integration', () => {
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
    test('GET redirects to upload form if there is no session upload', async () => {
      const cookie = await loginAsDevUser(server)

      const response = await server.inject({
        method: 'GET',
        url: CHECK_ANSWERS_URL,
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/create-guidance/upload-guide')
    })

    test('GET redirects to the guide details form if the guide details are missing', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await startMigration(server, devCookie)

      mockReferenceData()

      const response = await server.inject({
        method: 'GET',
        url: CHECK_ANSWERS_URL,
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe(
        '/create-guidance/upload-guide/metadata'
      )
    })

    test('GET renders 3 summary cards with captured metadata and Change actions', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)

      mockReferenceData()
      nock(GUIDANCE_API_BASE_URL)
        .get('/guides/staging/file-1')
        .once()
        .reply(
          statusCodes.HTTP_STATUS_OK,
          stagedDocumentResponse({
            parsingStatus: 'complete',
            version: '1.2',
            lastModified: '2026-04-01T10:00:00.000Z'
          })
        )

      const response = await server.inject({
        method: 'GET',
        url: CHECK_ANSWERS_URL,
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(response.payload).toContain('The guide&#39;s details')
      expect(response.payload).toContain('Owner and purpose')
      expect(response.payload).not.toContain('Who it&#39;s for and system access')
      expect(response.payload).toContain('Complete Guide Title')
      expect(response.payload).toContain('1.2')
      expect(response.payload).toContain('designer@example.com')
      expect(response.payload).toContain('Clear guidance purpose')
      expect(response.payload).toContain('Required knowledge and training')
      expect(response.payload).toContain('Standard training required')
      expect(response.payload).toContain('Who is this guidance for?')
      expect(response.payload).toContain('Processor')
      expect(response.payload).toContain('Convert document')
      expect(response.payload).toContain(
        'href="/create-guidance/upload-guide/metadata?from=check"'
      )
      expect(response.payload).toContain(
        'href="/create-guidance/upload-guide/metadata/purpose?from=check"'
      )
    })

    test('Change action returns to check-answers when continuing from metadata screen', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)

      mockReferenceData()
      nock(GUIDANCE_API_BASE_URL)
        .get('/guides/staging/file-1')
        .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse())

      const getChangeResponse = await server.inject({
        method: 'GET',
        url: '/create-guidance/upload-guide/metadata?from=check',
        headers: { cookie }
      })

      expect(getChangeResponse.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(getChangeResponse.payload).toContain(
        'action="/create-guidance/upload-guide/metadata?from=check"'
      )

      nock(GUIDANCE_API_BASE_URL)
        .get('/reference/schemes')
        .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

      const postChangeResponse = await server.inject({
        method: 'POST',
        url: '/create-guidance/upload-guide/metadata?from=check',
        payload: { guideTitle: 'Updated Guide Title', schemes: ['sfi'] },
        headers: { cookie }
      })

      expect(postChangeResponse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(postChangeResponse.headers.location).toBe(CHECK_ANSWERS_URL)
    })

    test('POST converts document and redirects to dashboard on success', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)

      mockReferenceData()

      const response = await server.inject({
        method: 'POST',
        url: CHECK_ANSWERS_URL,
        payload: {},
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/designer/dashboard')
    })

    test('POST redisplays check answers with an error summary when a saved answer is no longer a valid reference option', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)

      nock(GUIDANCE_API_BASE_URL)
        .get('/reference/schemes')
        .reply(statusCodes.HTTP_STATUS_OK, schemesResponse([
          { value: 'other-scheme', label: 'Other scheme' }
        ]))
      nock(GUIDANCE_API_BASE_URL)
        .get('/reference/systems')
        .reply(statusCodes.HTTP_STATUS_OK, systemsResponse())
      nock(GUIDANCE_API_BASE_URL)
        .get('/reference/audiences')
        .reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())
      nock(GUIDANCE_API_BASE_URL)
        .get('/guides/staging/file-1')
        .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse())

      const response = await server.inject({
        method: 'POST',
        url: CHECK_ANSWERS_URL,
        payload: {},
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(response.payload).toContain('There is a problem')
      expect(response.payload).toContain(
        'Select at least one scheme this guidance relates to'
      )
    })
  })

  describe('When not logged in', () => {
    test('GET redirects to /', async () => {
      const response = await server.inject({
        method: 'GET',
        url: CHECK_ANSWERS_URL
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/')
    })

    test('POST redirects to /', async () => {
      const response = await server.inject({
        method: 'POST',
        url: CHECK_ANSWERS_URL,
        payload: {}
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/')
    })
  })
})
