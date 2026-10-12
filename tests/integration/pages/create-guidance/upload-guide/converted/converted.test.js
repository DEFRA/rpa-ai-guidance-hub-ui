import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../src/server/server.js'
import { config } from '../../../../../../src/config/config.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { completeAllMetadata, mockReferenceData } from '../../../../helpers/upload-journey.js'
import { createdGuideResponse } from '../../../../../fixtures/guidance-api.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'
const CONVERTED_URL = '/create-guidance/upload-guide/converted'

describe('Guidance converted page', () => {
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
})
