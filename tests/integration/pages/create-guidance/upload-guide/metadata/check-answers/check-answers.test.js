import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../../helpers/login.js'
import { mergeCookies } from '../../../../../helpers/cookies.js'
import { config } from '../../../../../../../src/config/config.js'
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
const CONVERTED_URL = '/create-guidance/upload-guide/converted'

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

    test('POST converts document and confirms it, after which create guidance starts a new guide', async () => {
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
      expect(response.headers.location).toBe(CONVERTED_URL)

      const convertedCookie = mergeCookies(cookie, response.headers['set-cookie'])
      const converted = await server.inject({
        method: 'GET',
        url: CONVERTED_URL,
        headers: { cookie: convertedCookie }
      })

      expect(converted.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

      await expectFreshUploadForm(server, mergeCookies(convertedCookie, converted.headers['set-cookie']))
    })

    describe('Saving the converted document in the background', () => {
      const CONVERTING_URL = '/create-guidance/upload-guide/converting'

      function saving (fields) {
        return stagedDocumentResponse({
          parsingStatus: 'complete',
          documentId: 'document-1',
          savingStatus: 'in_progress',
          saveStepsCompleted: 0,
          saveStepsTotal: null,
          ...fields
        })
      }

      async function submit () {
        const devCookie = await loginAsDevUser(server)
        const cookie = await completeAllMetadata(server, devCookie)

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post('/guides')
          .reply(statusCodes.HTTP_STATUS_ACCEPTED, saving({}), { location: '/guides/staging/file-1' })

        const response = await server.inject({ method: 'POST', url: CHECK_ANSWERS_URL, payload: {}, headers: { cookie } })

        return { response, cookie: mergeCookies(cookie, response.headers['set-cookie']) }
      }

      async function converting (cookie, stagedDocument) {
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .reply(statusCodes.HTTP_STATUS_OK, stagedDocument)

        return server.inject({ method: 'GET', url: CONVERTING_URL, headers: { cookie } })
      }

      test('when the API accepts the document, the service shows the converting page', async () => {
        const { response } = await submit()

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(response.headers.location).toBe(CONVERTING_URL)
      })

      test('the converting page shows a progress bar of the parts saved, in the style of the existing progress bar', async () => {
        const { cookie } = await submit()

        const page = await converting(cookie, saving({ saveStepsCompleted: 37, saveStepsTotal: 74 }))

        expect(page.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
        expect(page.result).toContain('class="app-progress"')
        expect(page.result).toContain('aria-valuenow="50"')
        expect(page.result).toContain('Saving the document: 37 of 74 parts saved')
        expect(page.result).toContain('data-poll-url="/create-guidance/upload-guide/converting/status"')
      })

      test('the page gets the progress again from the status the browser polls', async () => {
        const { cookie } = await submit()
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .reply(statusCodes.HTTP_STATUS_OK, saving({ saveStepsCompleted: 74, saveStepsTotal: 74 }))

        const status = await server.inject({ method: 'GET', url: `${CONVERTING_URL}/status`, headers: { cookie } })

        expect(JSON.parse(status.payload)).toEqual(expect.objectContaining({ percentage: 100, isComplete: false }))
      })

      test('when the save is complete, the service shows the Guidance converted page', async () => {
        const { cookie } = await submit()

        const page = await converting(cookie, saving({ savingStatus: 'complete', saveStepsCompleted: 74, saveStepsTotal: 74 }))
        expect(page.headers.location).toBe(CONVERTED_URL)

        const confirmation = await server.inject({
          method: 'GET',
          url: CONVERTED_URL,
          headers: { cookie: mergeCookies(cookie, page.headers['set-cookie']) }
        })

        expect(confirmation.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
        expect(confirmation.result).toContain('Complete Guide Title')
      })

      test('when the save fails, the page shows an error that tells the user what to do next', async () => {
        const { cookie } = await submit()

        const page = await converting(cookie, saving({ savingStatus: 'failed', saveStepsCompleted: 3, saveStepsTotal: 74, saveError: 'refused' }))

        expect(page.result).toContain('The document could not be converted')
        expect(page.result).toContain('Go back to check your answers and select Convert document again. If this keeps happening, contact the support team')
        expect(page.result.replace(/\s+/g, ' ')).toMatch(/<title> Error: Converting your document \| /)
      })
    })

    describe('Guidance converted confirmation', () => {
      /**
       * Convert the guide from check answers, then open the confirmation it
       * redirects to.
       */
      async function convertAndConfirm () {
        const devCookie = await loginAsDevUser(server)
        const cookie = await completeAllMetadata(server, devCookie)

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post('/guides')
          .reply(statusCodes.HTTP_STATUS_CREATED, createdGuideResponse())

        const submitted = await server.inject({
          method: 'POST',
          url: CHECK_ANSWERS_URL,
          payload: {},
          headers: { cookie }
        })
        const convertedCookie = mergeCookies(cookie, submitted.headers['set-cookie'])
        const confirmation = await server.inject({
          method: 'GET',
          url: submitted.headers.location,
          headers: { cookie: convertedCookie }
        })

        return {
          submitted,
          confirmation,
          text: confirmation.payload.replaceAll(/\s+/g, ' '),
          cookie: mergeCookies(convertedCookie, confirmation.headers['set-cookie'])
        }
      }

      test('when the conversion is complete, the service shows the Guidance converted page', async () => {
        const { submitted, confirmation } = await convertAndConfirm()

        expect(submitted.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(submitted.headers.location).toBe(CONVERTED_URL)
        expect(confirmation.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      })

      test('the page shows a GOV.UK panel with Guidance converted and the guide title the user gave', async () => {
        const { text } = await convertAndConfirm()

        expect(text).toMatch(/<div class="govuk-panel govuk-panel--confirmation"> <h1 class="govuk-panel__title"> Guidance converted <\/h1> <div class="govuk-panel__body"> Complete Guide Title <\/div> <\/div>/)
      })

      test('the page shows the What happens next text from the prototype', async () => {
        const { text } = await convertAndConfirm()

        expect(text).toContain('<h2 class="govuk-heading-m">What happens next</h2>')
        expect(text).toContain('Your document is now markdown in the hub, saved as a draft. Only you can see it until it is reviewed and published.')
        expect(text).toContain('Have a look at how it converted before you take it any further.')
      })

      test('the page shows a View the guidance button that does not open a different page', async () => {
        const { text } = await convertAndConfirm()

        expect(text).toMatch(/<a href="#" [^>]*class="govuk-button"[^>]*> View the guidance <\/a>/)
      })

      test('the page shows a Convert another document link to the start of the upload', async () => {
        const { text } = await convertAndConfirm()

        expect(text).toContain('<a class="govuk-link" href="/create-guidance/upload-guide">Convert another document</a>')
      })

      test('the page shows one time only: a refresh shows the Hub and does not convert the document again', async () => {
        const { cookie } = await convertAndConfirm()
        const secondConversion = nock(GUIDANCE_API_BASE_URL)
          .post('/guides')
          .reply(statusCodes.HTTP_STATUS_CREATED, createdGuideResponse())

        const refreshed = await server.inject({
          method: 'GET',
          url: CONVERTED_URL,
          headers: { cookie }
        })

        expect(refreshed.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(refreshed.headers.location).toBe('/hub')
        expect(secondConversion.isDone()).toBe(false)
      })

      test('when the user opens the page and there is no new conversion, the service shows the Hub', async () => {
        const devCookie = await loginAsDevUser(server)

        const response = await server.inject({
          method: 'GET',
          url: CONVERTED_URL,
          headers: { cookie: devCookie }
        })

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(response.headers.location).toBe('/hub')
      })

      test('the browser tab shows the title Guidance converted', async () => {
        const { text } = await convertAndConfirm()

        expect(text).toMatch(/<title> Guidance converted \| /)
      })
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
