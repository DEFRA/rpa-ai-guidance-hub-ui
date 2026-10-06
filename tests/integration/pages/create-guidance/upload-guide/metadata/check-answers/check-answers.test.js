import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../../helpers/login.js'
import { mergeCookies } from '../../../../../helpers/cookies.js'
import { config } from '../../../../../../../src/config/config.js'
import { guidanceApiClient } from '../../../../../../../src/infra/guidance-api/client.js'
import {
  audiencesResponse,
  createdGuideResponse,
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
const CONVERTING_URL = '/create-guidance/upload-guide/converting'

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

async function expectFreshUploadForm (server, cookie) {
  nock(CDP_UPLOADER_URL)
    .post('/initiate')
    .reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({
      uploadId: 'u-next',
      uploadUrl: 'http://cdp-uploader.test/upload-and-scan/u-next'
    }))

  const response = await server.inject({
    method: 'GET',
    url: '/create-guidance/upload-guide',
    headers: { cookie }
  })

  expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
  expect(response.payload).toContain('/upload-and-scan/u-next')
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

    test('POST converts document and redirects to hub on success, after which create guidance starts a new guide', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)

      mockReferenceData()

      const createGuide = nock(GUIDANCE_API_BASE_URL)
        .post('/guides', {
          source: { uploadId: 'u-check', fileId: 'file-1' },
          metadata: {
            guideTitle: 'Complete Guide Title',
            schemes: ['sfi'],
            owner: 'designer@example.com',
            goal: 'Clear guidance purpose',
            requirements: 'Standard training required',
            systems: ['crm'],
            audience: ['processor']
          },
          createdBy: { id: 'dev-user-123', displayName: 'Dev User' }
        })
        .reply(statusCodes.HTTP_STATUS_CREATED, createdGuideResponse())

      const response = await server.inject({
        method: 'POST',
        url: CHECK_ANSWERS_URL,
        payload: {},
        headers: { cookie }
      })

      createGuide.done()
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/hub')

      await expectFreshUploadForm(server, mergeCookies(cookie, response.headers['set-cookie']))
    })

    test('POST redisplays check answers asking for the document again when its upload has expired', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)

      mockReferenceData()
      nock(GUIDANCE_API_BASE_URL)
        .get('/guides/staging/file-1')
        .reply(statusCodes.HTTP_STATUS_NOT_FOUND)
      nock(GUIDANCE_API_BASE_URL)
        .post('/guides')
        .reply(statusCodes.HTTP_STATUS_NOT_FOUND, { detail: 'No staged file file-1: never delivered, or expired' })

      const response = await server.inject({
        method: 'POST',
        url: CHECK_ANSWERS_URL,
        payload: {},
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(response.payload).toContain('The uploaded document has expired. Start again and upload it again')
    })

    test.each([
      ['unfinished', 'in_progress', 'The uploaded document is still being processed. Wait a few seconds, then select Convert document again'],
      ['failed', 'failed', 'The uploaded document cannot be opened. Check you selected the correct file and that it has not been corrupted, then start over and upload it again. If this keeps happening, contact the support team']
    ])('POST redisplays check answers explaining why when the document parse is %s', async (_, parsingStatus, message) => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)

      mockReferenceData()
      nock(GUIDANCE_API_BASE_URL)
        .post('/guides')
        .reply(statusCodes.HTTP_STATUS_CONFLICT, { detail: `File file-1 is ${parsingStatus}, not parsed` })
      nock(GUIDANCE_API_BASE_URL)
        .get('/guides/staging/file-1')
        .times(2)
        .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus }))

      const response = await server.inject({
        method: 'POST',
        url: CHECK_ANSWERS_URL,
        payload: {},
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(response.payload).toContain(message)
    })

    test('POST tells the user conversion is taking a long time when the API is slower than the UI waits, until it has finished, then starts a new guide', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)
      const timeout = guidanceApiClient.timeout
      guidanceApiClient.timeout = 200

      try {
        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post('/guides')
          .delay(1000)
          .reply(statusCodes.HTTP_STATUS_CREATED, createdGuideResponse())

        const response = await server.inject({
          method: 'POST',
          url: CHECK_ANSWERS_URL,
          payload: {},
          headers: { cookie }
        })

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(response.headers.location).toBe(CONVERTING_URL)

        const convertingCookie = mergeCookies(cookie, response.headers['set-cookie'])
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({
            parsingStatus: 'complete', documentId: 'document-1', promotedAt: null
          }))

        const converting = await server.inject({
          method: 'GET',
          url: CONVERTING_URL,
          headers: { cookie: convertingCookie }
        })

        expect(converting.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
        expect(converting.payload).toContain('Converting this document is taking a long time')
        expect(converting.payload).toContain(`href="${CONVERTING_URL}"`)
        expect(converting.payload).toContain('Check again')

        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({
            parsingStatus: 'complete', documentId: 'document-1', promotedAt: '2026-10-06T11:00:00Z'
          }))

        const checkedAgain = await server.inject({
          method: 'GET',
          url: CONVERTING_URL,
          headers: { cookie: convertingCookie }
        })

        expect(checkedAgain.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(checkedAgain.headers.location).toBe('/hub')

        await expectFreshUploadForm(server, mergeCookies(convertingCookie, checkedAgain.headers['set-cookie']))
      } finally {
        guidanceApiClient.timeout = timeout
      }
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
