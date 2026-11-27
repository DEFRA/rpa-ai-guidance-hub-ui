import { constants as statusCodes } from 'node:http2'
import { within } from '@testing-library/dom'
import nock from 'nock'
import { createServer } from '../../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../../helpers/login.js'
import { mergeCookies } from '../../../../../helpers/cookies.js'
import { errorSummaryOf, pageOf, summaryValueOf } from '../../../../../helpers/page.js'
import {
  completeAllMetadata,
  completeDetails,
  expectFreshUploadForm,
  mockReferenceData,
  mockStagedFileRead,
  startMigration,
  uploadReadyToConvert
} from '../../../../../helpers/upload-journey.js'
import { config } from '../../../../../../../src/config/config.js'
import { guidanceApiClient } from '../../../../../../../src/infra/guidance-api/client.js'
import {
  audiencesResponse,
  createdGuideResponse,
  guideResponse,
  refusalResponse,
  schemesResponse,
  stagedDocumentResponse,
  systemsResponse,
  versionResponse
} from '../../../../../../fixtures/guidance-api.js'
import { RESULTS } from '../../../../../../../src/services/guides.js'
import { CONVERSION_MESSAGES, METADATA_MESSAGES, REFUSAL_MESSAGES } from '../../../../../../fixtures/messages.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'
const CONVERTED_URL = '/create-guidance/upload-guide/converted'
const CHOICE_URL = '/create-guidance/upload-guide/new-or-update'
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

// What converting sends for the answers `completeAllMetadata` gives.
const CONVERSION_REQUEST = {
  source: { uploadId: 'u-check', fileId: 'file-1' },
  metadata: {
    schemes: ['Sustainable Farming Incentive (SFI)'],
    owner: 'designer@example.com',
    goal: 'Clear guidance purpose',
    requirements: 'Standard training required',
    systems: ['CRM'],
    audience: ['Processor'],
    schemeYear: 2026
  },
  title: 'Complete Guide Title',
  versionNumber: '1.0',
  createdBy: { id: 'dev-user-123', displayName: 'Dev User' }
}

function cardTitled (page, title) {
  return within(page.getByRole('heading', { name: title }).closest('.govuk-summary-card'))
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

    test('GET says in a card that the upload is a new guide, with a Change link to choose again', async () => {
      const cookie = await uploadReadyToConvert(server)

      mockReferenceData()
      nock(GUIDANCE_API_BASE_URL)
        .get('/guides/staging/file-1')
        .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse())

      const response = await server.inject({
        method: 'GET',
        url: CHECK_ANSWERS_URL,
        headers: { cookie }
      })

      const card = cardTitled(pageOf(response.payload), 'New guide or new version')
      expect(summaryValueOf(card, 'This document is')).toHaveTextContent(/^A new guide$/)
      expect(card.getByRole('link', { name: /^Change/ })).toHaveAttribute('href', CHOICE_URL)
    })

    describe('For a new version of a guide', () => {
      const guide = guideResponse({ id: GUIDE_ID })
      // What converting sends for a new version: the version chosen to replace too.
      const VERSION_REQUEST = { ...CONVERSION_REQUEST, replacesVersionId: guide.versions[0].id }
      // What the API answers when it starts to save the new version in the background.
      const SAVE_STARTED = stagedDocumentResponse({
        parsingStatus: 'complete',
        documentId: GUIDE_ID,
        savingStatus: 'in_progress'
      })
      const SAVE_STARTED_AT = { location: '/guides/staging/file-1' }

      async function checkPage (chosen = guide) {
        const cookie = await uploadReadyToConvert(server, { updates: chosen })

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse())
        nock(GUIDANCE_API_BASE_URL)
          .get(`/guides/${GUIDE_ID}`)
          .reply(statusCodes.HTTP_STATUS_OK, chosen)

        const response = await server.inject({
          method: 'GET',
          url: CHECK_ANSWERS_URL,
          headers: { cookie }
        })

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

        return pageOf(response.payload)
      }

      /**
       * Select Convert document on the check page.
       */
      function submit (cookie) {
        return server.inject({
          method: 'POST',
          url: CHECK_ANSWERS_URL,
          payload: {},
          headers: { cookie }
        })
      }

      /**
       * Convert the new version, with the API's answer given.
       */
      async function convert (status, body, headers) {
        const cookie = await uploadReadyToConvert(server, { updates: guide })

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post(`/guides/${GUIDE_ID}/versions`)
          .reply(status, body, headers)

        const response = await submit(cookie)

        return { response, cookie: mergeCookies(cookie, response.headers['set-cookie']) }
      }

      /**
       * Convert the new version, which the API saves in the background.
       */
      function convertInBackground () {
        return convert(statusCodes.HTTP_STATUS_ACCEPTED, SAVE_STARTED, SAVE_STARTED_AT)
      }

      async function chooseNewGuide (cookie) {
        const response = await server.inject({
          method: 'POST',
          url: CHOICE_URL,
          payload: { kind: 'new', q: '' },
          headers: { cookie }
        })

        expect(response.headers.location).toBe('/create-guidance/upload-guide/metadata')

        return mergeCookies(cookie, response.headers['set-cookie'])
      }

      /**
       * The reference data with CRM, the system the answers name, retired.
       */
      function mockReferenceDataWithCrmRetired () {
        nock(GUIDANCE_API_BASE_URL)
          .get('/reference/schemes')
          .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
        nock(GUIDANCE_API_BASE_URL)
          .get('/reference/systems')
          .reply(statusCodes.HTTP_STATUS_OK, systemsResponse([{ label: 'SITI Agri' }]))
        nock(GUIDANCE_API_BASE_URL)
          .get('/reference/audiences')
          .reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())
      }

      test('GET names the guide in a card, with a Change link to choose again', async () => {
        const card = cardTitled(await checkPage(), 'New guide or new version')

        expect(summaryValueOf(card, 'This document is')).toHaveTextContent(/^A new version of ‘Claiming the SFI payment’$/)
        expect(card.getByRole('link', { name: /^Change/ })).toHaveAttribute('href', CHOICE_URL)
      })

      test('GET shows the details of a guide kept with a detail that the journey does not ask', async () => {
        const keptWithMore = guideResponse({
          id: GUIDE_ID,
          metadata: { ...guide.metadata, guidanceType: 'process' }
        })

        const page = await checkPage(keptWithMore)

        expect(page.getByRole('heading', { level: 1 })).toHaveTextContent('Check the details before you convert')
      })

      test('GET says that the new version goes live in the hub at once, for everyone who uses it', async () => {
        const main = (await checkPage()).document.querySelector('main')

        expect(main).toHaveTextContent('When you convert this document, the new version goes live in the hub at once. Everyone who uses the hub can see it.')
        expect(main).not.toHaveTextContent(/draft/)
      })

      test('POST asks the API to save the upload as a new version of the guide, replacing the version chosen, then follows the save', async () => {
        const cookie = await uploadReadyToConvert(server, { updates: guide })

        mockReferenceData()
        const createVersion = nock(GUIDANCE_API_BASE_URL)
          .post(`/guides/${GUIDE_ID}/versions`, VERSION_REQUEST)
          .reply(statusCodes.HTTP_STATUS_ACCEPTED, SAVE_STARTED, SAVE_STARTED_AT)

        const response = await submit(cookie)

        createVersion.done()
        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(response.headers.location).toBe('/create-guidance/upload-guide/converting')
      })

      describe('whose latest version has a SharePoint link', () => {
        const linkedGuide = guideResponse({
          id: GUIDE_ID,
          versions: [versionResponse({
            sourceLink: 'https://example.sharepoint.com/:w:/r/teams/Team1234/Claims/2025/Claiming%20the%20SFI%20payment.docx?web=1'
          })]
        })
        const LINKED_VERSION_REQUEST = { ...CONVERSION_REQUEST, replacesVersionId: linkedGuide.versions[0].id }

        test('POST sends the SharePoint link the maintainer gave for the new version, not the latest version\'s', async () => {
          const sourceLink = 'https://example.sharepoint.com/:w:/r/teams/Team1234/Claims/2026/Claiming%20the%20SFI%20payment.docx?web=1'
          const cookie = await uploadReadyToConvert(server, { updates: linkedGuide, sourceLink })
          mockReferenceData()
          const createVersion = nock(GUIDANCE_API_BASE_URL)
            .post(`/guides/${GUIDE_ID}/versions`, { ...LINKED_VERSION_REQUEST, sourceLink })
            .reply(statusCodes.HTTP_STATUS_ACCEPTED, SAVE_STARTED, SAVE_STARTED_AT)

          await submit(cookie)

          createVersion.done()
        })

        test('POST sends no SharePoint link when the maintainer cleared the one the new version started with', async () => {
          const cookie = await uploadReadyToConvert(server, { updates: linkedGuide })
          mockReferenceData()
          const createVersion = nock(GUIDANCE_API_BASE_URL)
            .post(`/guides/${GUIDE_ID}/versions`, LINKED_VERSION_REQUEST)
            .reply(statusCodes.HTTP_STATUS_ACCEPTED, SAVE_STARTED, SAVE_STARTED_AT)

          await submit(cookie)

          createVersion.done()
        })
      })

      test('POST again asks for the new version as submitted, though New guide and another title are chosen while it saves', async () => {
        const { cookie: submittedCookie } = await convertInBackground()

        const afterChoiceCookie = await chooseNewGuide(submittedCookie)

        nock(GUIDANCE_API_BASE_URL)
          .get('/reference/schemes')
          .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

        const changed = await server.inject({
          method: 'POST',
          url: '/create-guidance/upload-guide/metadata',
          payload: {
            guideTitle: 'Another Guide Title',
            versionNumber: '2.0',
            schemes: ['sustainable-farming-incentive-sfi']
          },
          headers: { cookie: afterChoiceCookie }
        })
        const afterMetadataCookie = mergeCookies(afterChoiceCookie, changed.headers['set-cookie'])

        mockReferenceData()
        const createVersion = nock(GUIDANCE_API_BASE_URL)
          .post(`/guides/${GUIDE_ID}/versions`, VERSION_REQUEST)
          .reply(statusCodes.HTTP_STATUS_ACCEPTED, SAVE_STARTED, SAVE_STARTED_AT)

        const response = await submit(afterMetadataCookie)

        createVersion.done()
        expect(response.headers.location).toBe('/create-guidance/upload-guide/converting')
      })

      test('POST again asks for the new version as submitted, though an option its answers name is retired since', async () => {
        const { cookie: submittedCookie } = await convertInBackground()

        mockReferenceDataWithCrmRetired()
        const createVersion = nock(GUIDANCE_API_BASE_URL)
          .post(`/guides/${GUIDE_ID}/versions`, VERSION_REQUEST)
          .reply(statusCodes.HTTP_STATUS_ACCEPTED, SAVE_STARTED, SAVE_STARTED_AT)

        const response = await submit(submittedCookie)

        createVersion.done()
        expect(response.headers.location).toBe('/create-guidance/upload-guide/converting')
      })

      test('GET shows the answers as submitted, though an option they name is retired since', async () => {
        const { cookie: submittedCookie } = await convertInBackground()

        mockReferenceDataWithCrmRetired()
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .reply(statusCodes.HTTP_STATUS_OK, SAVE_STARTED)
        nock(GUIDANCE_API_BASE_URL)
          .get(`/guides/${GUIDE_ID}`)
          .reply(statusCodes.HTTP_STATUS_OK, guide)

        const response = await server.inject({
          method: 'GET',
          url: CHECK_ANSWERS_URL,
          headers: { cookie: submittedCookie }
        })

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
        expect(pageOf(response.payload).getByRole('heading', { level: 1 })).toHaveTextContent('Check the details before you convert')
      })

      test('POST redisplays check answers saying that someone saved a newer version first, when the guide has one', async () => {
        const cookie = await uploadReadyToConvert(server, { updates: guide })
        const newer = guideResponse({
          id: GUIDE_ID,
          versions: [versionResponse({ id: 'version-2' }), ...guide.versions]
        })

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post(`/guides/${GUIDE_ID}/versions`)
          .reply(statusCodes.HTTP_STATUS_CONFLICT, {
            detail: {
              message: 'Version version-1 is not the latest',
              latestVersionId: 'version-2'
            }
          })
        nock(GUIDANCE_API_BASE_URL)
          .get(`/guides/${GUIDE_ID}`)
          .times(2)
          .reply(statusCodes.HTTP_STATUS_OK, newer)
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse())

        const response = await submit(cookie)

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
        expect(pageOf(response.payload).getByRole('alert')).toHaveTextContent(REFUSAL_MESSAGES.replacedFirst('Claiming the SFI payment'))
      })

      test('POST still explains an unfinished parse, when the guide has no newer version', async () => {
        const cookie = await uploadReadyToConvert(server, { updates: guide })

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post(`/guides/${GUIDE_ID}/versions`)
          .reply(statusCodes.HTTP_STATUS_CONFLICT, refusalResponse({ detail: 'File file-1 is in_progress, not parsed' }))
        nock(GUIDANCE_API_BASE_URL)
          .get(`/guides/${GUIDE_ID}`)
          .times(2)
          .reply(statusCodes.HTTP_STATUS_OK, guide)
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .times(2)
          .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'in_progress' }))

        const response = await submit(cookie)

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
        expect(pageOf(response.payload).getByRole('alert')).toHaveTextContent(REFUSAL_MESSAGES[RESULTS.PARSE_PENDING])
      })

      test('POST says the document is kept for the guide chosen first, when its file is kept for another guide', async () => {
        const cookie = await uploadReadyToConvert(server, { updates: guide })

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post(`/guides/${GUIDE_ID}/versions`)
          .reply(statusCodes.HTTP_STATUS_CONFLICT, refusalResponse({ detail: 'File file-1 is being made into another-guide' }))
        nock(GUIDANCE_API_BASE_URL)
          .get(`/guides/${GUIDE_ID}`)
          .times(2)
          .reply(statusCodes.HTTP_STATUS_OK, guide)
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .times(2)
          .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({
            parsingStatus: 'complete',
            documentId: 'another-guide'
          }))

        const response = await submit(cookie)

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
        expect(pageOf(response.payload).getByRole('alert')).toHaveTextContent(REFUSAL_MESSAGES[RESULTS.KEPT_FOR_ANOTHER])
      })

      test('POST says the document is kept for the guide chosen first, when New guide is chosen after a failed submission', async () => {
        const readyCookie = await uploadReadyToConvert(server, { updates: guide })

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post(`/guides/${GUIDE_ID}/versions`)
          .reply(statusCodes.HTTP_STATUS_SERVICE_UNAVAILABLE, refusalResponse({ detail: 'The conversion could not be started; try again' }))

        const failed = await submit(readyCookie)
        const failedCookie = mergeCookies(readyCookie, failed.headers['set-cookie'])

        // Not submitted, so the new choice starts the details again, reading the file.
        mockStagedFileRead()
        const afterChoiceCookie = await chooseNewGuide(failedCookie)

        const afterDetailsCookie = await completeDetails(server, afterChoiceCookie)

        mockReferenceData()
        nock(GUIDANCE_API_BASE_URL)
          .post('/guides')
          .reply(statusCodes.HTTP_STATUS_CONFLICT, refusalResponse({ detail: `File file-1 is being made into a version of ${GUIDE_ID}` }))
        nock(GUIDANCE_API_BASE_URL)
          .get('/guides/staging/file-1')
          .times(2)
          .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({
            parsingStatus: 'complete',
            documentId: GUIDE_ID
          }))

        const response = await submit(afterDetailsCookie)

        expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
        expect(pageOf(response.payload).getByRole('alert')).toHaveTextContent(REFUSAL_MESSAGES[RESULTS.KEPT_FOR_ANOTHER])
      })

      describe('The Guidance converted page', () => {
        const LIVE = 'The new version is live in the hub. Everyone who uses the hub can see it.'
        // What the API answers once the new version is saved.
        const SAVED = stagedDocumentResponse({
          parsingStatus: 'complete',
          documentId: GUIDE_ID,
          savingStatus: 'complete'
        })

        async function confirmation (cookie) {
          const response = await server.inject({
            method: 'GET',
            url: CONVERTED_URL,
            headers: { cookie }
          })

          expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

          return pageOf(response.payload).document.querySelector('main')
        }

        test('says the new version is live for everyone, and not a draft, when the API made it before', async () => {
          const { response, cookie } = await convert(statusCodes.HTTP_STATUS_OK, createdGuideResponse({ id: GUIDE_ID }))
          expect(response.headers.location).toBe(CONVERTED_URL)

          const main = await confirmation(cookie)

          expect(main).toHaveTextContent(LIVE)
          expect(main).not.toHaveTextContent(/draft/)
        })

        test('says the new version is live for everyone, and not a draft, once its save in the background is complete', async () => {
          const { response, cookie: submittedCookie } = await convertInBackground()

          nock(GUIDANCE_API_BASE_URL)
            .get('/guides/staging/file-1')
            .reply(statusCodes.HTTP_STATUS_OK, SAVED)

          const converting = await server.inject({
            method: 'GET',
            url: response.headers.location,
            headers: { cookie: submittedCookie }
          })
          expect(converting.headers.location).toBe(CONVERTED_URL)
          const savedCookie = mergeCookies(submittedCookie, converting.headers['set-cookie'])

          const main = await confirmation(savedCookie)

          expect(main).toHaveTextContent(LIVE)
          expect(main).not.toHaveTextContent(/draft/)
        })

        test('confirms the new version with the title submitted, though New guide is chosen while it saves', async () => {
          const { cookie: submittedCookie } = await convertInBackground()

          const afterChoiceCookie = await chooseNewGuide(submittedCookie)

          nock(GUIDANCE_API_BASE_URL)
            .get('/guides/staging/file-1')
            .reply(statusCodes.HTTP_STATUS_OK, SAVED)

          const converting = await server.inject({
            method: 'GET',
            url: '/create-guidance/upload-guide/converting',
            headers: { cookie: afterChoiceCookie }
          })
          expect(converting.headers.location).toBe(CONVERTED_URL)
          const savedCookie = mergeCookies(afterChoiceCookie, converting.headers['set-cookie'])

          const main = await confirmation(savedCookie)

          expect(main).toHaveTextContent(LIVE)
          expect(within(main).getByText('Complete Guide Title')).toHaveClass('govuk-panel__body')
        })
      })
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
        .post('/guides', CONVERSION_REQUEST)
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

    test('POST sends the SharePoint link the maintainer gave, as given, beside the title', async () => {
      const sourceLink = 'https://example.sharepoint.com/:w:/r/teams/Team1234/Claims/Complete%20Guide%20Title.docx?web=1'
      const cookie = await completeAllMetadata(server, await loginAsDevUser(server), { sourceLink })
      mockReferenceData()
      const createGuide = nock(GUIDANCE_API_BASE_URL)
        .post('/guides', { ...CONVERSION_REQUEST, sourceLink })
        .reply(statusCodes.HTTP_STATUS_CREATED, createdGuideResponse())

      const response = await server.inject({
        method: 'POST',
        url: CHECK_ANSWERS_URL,
        payload: {},
        headers: { cookie }
      })

      createGuide.done()
      expect(response.headers.location).toBe(CONVERTED_URL)
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
