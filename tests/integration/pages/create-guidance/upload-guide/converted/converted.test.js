import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../src/server/server.js'
import { config } from '../../../../../../src/config/config.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { pageOf } from '../../../../helpers/page.js'
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
    await server?.stop({ timeout: 0 })
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
        page: pageOf(confirmation.payload),
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
      const { page } = await convertAndConfirm()

      const panel = page.getByRole('heading', { level: 1, name: 'Guidance converted' }).closest('.govuk-panel')
      expect(panel).toHaveClass('govuk-panel--confirmation')
      expect(panel.querySelector('.govuk-panel__body')).toHaveTextContent(/^Complete Guide Title$/)
    })

    test('the page shows the What happens next text from the prototype', async () => {
      const { page } = await convertAndConfirm()

      expect(page.getByRole('heading', { level: 2, name: 'What happens next' })).toBeInTheDocument()
      expect(page.getByText('Your document is now markdown in the hub, saved as a draft. Only you can see it until it is reviewed and published.')).toBeInTheDocument()
      expect(page.getByText('Have a look at how it converted before you take it any further.')).toBeInTheDocument()
    })

    test('the page shows a View the guidance button that does not open a different page', async () => {
      const { page } = await convertAndConfirm()

      expect(page.getByRole('button', { name: 'View the guidance' })).toHaveAttribute('href', '#')
    })

    test('the page shows a Convert another document link to the start of the upload', async () => {
      const { page } = await convertAndConfirm()

      expect(page.getByRole('link', { name: 'Convert another document' })).toHaveAttribute('href', '/create-guidance/upload-guide')
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
      const { page } = await convertAndConfirm()

      expect(page.document.title).toMatch(/^Guidance converted \| /)
    })
  })
})
