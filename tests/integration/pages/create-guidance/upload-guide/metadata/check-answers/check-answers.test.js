import { constants as statusCodes } from 'node:http2'
import { within } from '@testing-library/dom'
import nock from 'nock'
import { createServer } from '../../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../../helpers/login.js'
import { mergeCookies } from '../../../../../helpers/cookies.js'
import { errorSummaryOf, pageOf, summaryValueOf } from '../../../../../helpers/page.js'
import {
  completeAllMetadata,
  expectFreshUploadForm,
  mockReferenceData,
  startMigration
} from '../../../../../helpers/upload-journey.js'
import { config } from '../../../../../../../src/config/config.js'
import { guidanceApiClient } from '../../../../../../../src/infra/guidance-api/client.js'
import {
  audiencesResponse,
  createdGuideResponse,
  schemesResponse,
  stagedDocumentResponse,
  systemsResponse
} from '../../../../../../fixtures/guidance-api.js'
import { METADATA_MESSAGES } from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/schemas/metadata-schema.js'
import { CONVERSION_MESSAGES } from '../../../../../../../src/pages/create-guidance/upload-guide/converting/progress.js'
import { REFUSAL_MESSAGES } from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/check-answers/controller.js'
import { RESULTS } from '../../../../../../../src/services/guides.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'
const CONVERTED_URL = '/create-guidance/upload-guide/converted'

describe('#checkAnswersController Integration', () => {
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

      const page = pageOf(response.payload)
      const cardTitled = (title) => within(page.getByRole('heading', { name: title }).closest('.govuk-summary-card'))
      const details = cardTitled('The guide\'s details')
      const purpose = cardTitled('Owner and purpose')
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.queryByRole('heading', { name: 'Who it\'s for and system access' })).not.toBeInTheDocument()
      expect(summaryValueOf(details, 'Guidance title')).toHaveTextContent('Complete Guide Title')
      // The version number the user gave, not the document's own.
      expect(summaryValueOf(details, 'Version number')).toHaveTextContent(/^1\.0$/)
      expect(page.document.querySelector('main')).not.toHaveTextContent('1.2')
      expect(summaryValueOf(purpose, 'Owner email')).toHaveTextContent('designer@example.com')
      expect(summaryValueOf(purpose, 'Purpose of guidance')).toHaveTextContent('Clear guidance purpose')
      expect(summaryValueOf(purpose, 'Required knowledge and training')).toHaveTextContent('Standard training required')
      expect(summaryValueOf(purpose, 'Who is this guidance for?')).toHaveTextContent('Processor')
      expect(details.getByRole('link', { name: /^Change/ })).toHaveAttribute('href', '/create-guidance/upload-guide/metadata?from=check')
      expect(purpose.getByRole('link', { name: /^Change/ })).toHaveAttribute('href', '/create-guidance/upload-guide/metadata/purpose?from=check')
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
      expect(pageOf(getChangeResponse.payload).getByLabelText('Guidance title').form).toHaveAttribute('action', '/create-guidance/upload-guide/metadata?from=check')

      nock(GUIDANCE_API_BASE_URL)
        .get('/reference/schemes')
        .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

      const postChangeResponse = await server.inject({
        method: 'POST',
        url: '/create-guidance/upload-guide/metadata?from=check',
        payload: { guideTitle: 'Updated Guide Title', versionNumber: '1.0', schemes: ['sustainable-farming-incentive-sfi'] },
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
            schemes: ['Sustainable Farming Incentive (SFI)'],
            owner: 'designer@example.com',
            goal: 'Clear guidance purpose',
            requirements: 'Standard training required',
            systems: ['CRM'],
            audience: ['Processor'],
            schemeYear: 2026
          },
          versionNumber: '1.0',
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

        const shown = pageOf(page.result)
        const progress = shown.getByRole('progressbar', { name: 'Saving the document: 37 of 74 parts saved' })
        expect(page.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
        expect(progress).toHaveAttribute('aria-valuenow', '50')
        expect(progress.parentElement).toHaveClass('app-progress')
        expect(shown.document.querySelector('[data-module="app-progress"]')).toHaveAttribute('data-poll-url', '/create-guidance/upload-guide/converting/status')
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
        expect(pageOf(confirmation.result).getByText('Complete Guide Title')).toHaveClass('govuk-panel__body')
      })

      test('when the save fails, the page shows an error that tells the user what to do next', async () => {
        const { cookie } = await submit()

        const page = await converting(cookie, saving({ savingStatus: 'failed', saveStepsCompleted: 3, saveStepsTotal: 74, saveError: 'refused' }))

        const shown = pageOf(page.result)
        expect(shown.getByRole('alert')).toHaveTextContent(CONVERSION_MESSAGES.failed)
        expect(shown.getByRole('alert')).toHaveTextContent(CONVERSION_MESSAGES.failedDetail)
        expect(shown.document.title).toMatch(/^Error: Converting your document \| /)
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
      expect(pageOf(response.payload).getByRole('alert')).toHaveTextContent(REFUSAL_MESSAGES[RESULTS.UPLOAD_EXPIRED])
    })

    test.each([
      ['unfinished', 'in_progress', REFUSAL_MESSAGES[RESULTS.PARSE_PENDING]],
      ['failed', 'failed', REFUSAL_MESSAGES[RESULTS.PARSE_FAILED]]
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
      expect(pageOf(response.payload).getByRole('alert')).toHaveTextContent(message)
    })

    test('POST waits for a conversion slower than the API client\'s timeout, then starts a new guide', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await completeAllMetadata(server, devCookie)
      const timeout = guidanceApiClient.timeout
      guidanceApiClient.timeout = 100

      try {
        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post('/guides')
          .delay(300)
          .reply(statusCodes.HTTP_STATUS_CREATED, createdGuideResponse())

        const response = await server.inject({
          method: 'POST',
          url: CHECK_ANSWERS_URL,
          payload: {},
          headers: { cookie }
        })

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(response.headers.location).toBe(CONVERTED_URL)

        await expectFreshUploadForm(server, mergeCookies(cookie, response.headers['set-cookie']))
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
          { label: 'Other scheme' }
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

      const errors = errorSummaryOf(pageOf(response.payload))
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(errors.getByRole('heading', { name: 'There is a problem' })).toBeInTheDocument()
      expect(errors.getByRole('link', { name: METADATA_MESSAGES.schemeRequired })).toBeInTheDocument()
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
