import { constants as statusCodes } from 'node:http2'
import nock from 'nock'
import { createServer } from '../../../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../../../helpers/login.js'
import { mergeCookies } from '../../../../../helpers/cookies.js'
import { config } from '../../../../../../../src/config/config.js'
import {
  schemesResponse,
  systemsResponse,
  audiencesResponse
} from '../../../../../../fixtures/guidance-api.js'
import { initiateUploadResponse } from '../../../../../../fixtures/cdp-uploader.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')

const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'

function mockSchemes (times = 1) {
  nock(GUIDANCE_API_BASE_URL).get('/reference/schemes').times(times).reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
}

function mockReferenceOptions (times = 1) {
  nock(GUIDANCE_API_BASE_URL).get('/reference/systems').times(times).reply(statusCodes.HTTP_STATUS_OK, systemsResponse())
  nock(GUIDANCE_API_BASE_URL).get('/reference/audiences').times(times).reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())
}

function validPayload (overrides = {}) {
  return {
    owner: 'owner@example.com',
    goal: 'Explains how to process a claim',
    requirements: 'CRM access and claims training',
    systems: ['crm'],
    audience: ['processor', 'team-leader'],
    ...overrides
  }
}

async function startMigration (server, cookie, uploadId = 'u-purpose') {
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

async function completeGuideDetails (server, cookie) {
  mockSchemes()

  const post = await server.inject({
    method: 'POST',
    url: '/create-guidance/upload-guide/metadata',
    payload: { guideTitle: 'A valid title', schemes: ['sfi'] },
    headers: { cookie }
  })

  expect(post.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
  expect(post.headers.location).toBe(PURPOSE_URL)

  return mergeCookies(cookie, post.headers['set-cookie'])
}

async function reachPurposeScreen (server) {
  const devCookie = await loginAsDevUser(server)
  const uploadCookie = await startMigration(server, devCookie)

  return completeGuideDetails(server, uploadCookie)
}

describe('#purposeController Integration', () => {
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
    test('GET redirects to /create-guidance/upload-guide if no session upload', async () => {
      const cookie = await loginAsDevUser(server)

      const response = await server.inject({ method: 'GET', url: PURPOSE_URL, headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/create-guidance/upload-guide')
    })

    test('GET redirects to the guide details form if its answers are missing', async () => {
      const devCookie = await loginAsDevUser(server)
      const cookie = await startMigration(server, devCookie)

      const response = await server.inject({ method: 'GET', url: PURPOSE_URL, headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/create-guidance/upload-guide/metadata')
    })

    test('GET renders the form with reference options once the guide details are complete', async () => {
      const cookie = await reachPurposeScreen(server)
      mockReferenceOptions()

      const response = await server.inject({ method: 'GET', url: PURPOSE_URL, headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(response.payload).toContain('Owner and purpose')
      expect(response.payload).toContain('Owner email')
      expect(response.payload).toContain('The email address of who approves and publishes this guide')
      expect(response.payload).toContain('autocomplete="email"')
      expect(response.payload).toContain('What is the purpose of this guidance?')
      expect(response.payload).toContain('data-maxlength="200"')
      expect(response.payload).toContain('You can enter up to 200 characters')
      expect(response.payload).toContain('Required knowledge and training')
      expect(response.payload).toContain('What systems will you use?')
      expect(response.payload).toContain('Select all systems this guidance uses.')
      expect(response.payload).toContain('SITI Agri')
      expect(response.payload).toContain('Who is this guidance for?')
      expect(response.payload).toContain('Select all that apply.')
      expect(response.payload).toContain('Team leader')
      expect(response.payload).toContain('href="/create-guidance/upload-guide/metadata"')
    })

    test('POST with an empty payload re-renders 400 listing every error in page order', async () => {
      const cookie = await reachPurposeScreen(server)

      mockReferenceOptions(2)

      const response = await server.inject({ method: 'POST', url: PURPOSE_URL, payload: {}, headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(response.payload).toContain('There is a problem')

      const expectedOrder = [
        'Enter an email address',
        'Enter what this guidance aims to achieve',
        'Enter what users need to perform or understand',
        'Select the systems this guidance uses',
        'Select who this guidance is for'
      ]
      const positions = expectedOrder.map((message) => response.payload.indexOf(message))

      expect(positions.every((position) => position !== -1)).toBe(true)
      expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    })

    test('POST with an invalid email re-renders 400 keeping the entered values', async () => {
      const cookie = await reachPurposeScreen(server)
      mockReferenceOptions(2)

      const response = await server.inject({
        method: 'POST',
        url: PURPOSE_URL,
        payload: validPayload({ owner: 'not-an-email', systems: 'siti-agri' }),
        headers: { cookie }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(response.payload).toContain('Enter an email address in the correct format')
      expect(response.payload).toContain('value="not-an-email"')
      expect(response.payload).toContain('Explains how to process a claim')
      expect(response.payload).toMatch(/value="siti-agri"\s+checked/)
      expect(response.payload).toMatch(/value="team-leader"\s+checked/)
    })

    test('POST with valid answers saves them and redirects to check answers', async () => {
      const cookie = await reachPurposeScreen(server)
      mockReferenceOptions()

      const post = await server.inject({ method: 'POST', url: PURPOSE_URL, payload: validPayload(), headers: { cookie } })

      expect(post.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(post.headers.location).toBe(CHECK_ANSWERS_URL)

      const savedCookie = mergeCookies(cookie, post.headers['set-cookie'])

      mockSchemes()
      mockReferenceOptions()
      const checkAnswers = await server.inject({ method: 'GET', url: CHECK_ANSWERS_URL, headers: { cookie: savedCookie } })

      expect(checkAnswers.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(checkAnswers.payload).toContain('Check the details before you convert')
      expect(checkAnswers.payload).toContain('A valid title')
      expect(checkAnswers.payload).toContain('Sustainable Farming Incentive (SFI)')
      expect(checkAnswers.payload).toContain('owner@example.com')
      expect(checkAnswers.payload).toContain('CRM')
      expect(checkAnswers.payload).toContain('Processor')
      expect(checkAnswers.payload).toContain('Team leader')

      mockReferenceOptions()
      const purpose = await server.inject({ method: 'GET', url: PURPOSE_URL, headers: { cookie: savedCookie } })

      expect(purpose.payload).toContain('value="owner@example.com"')
      expect(purpose.payload).toMatch(/value="crm"\s+checked/)

      // ...and the guide details, proving the two screens merged into one session object
      mockSchemes()
      const details = await server.inject({ method: 'GET', url: '/create-guidance/upload-guide/metadata', headers: { cookie: savedCookie } })

      expect(details.payload).toContain('value="A valid title"')
    })

    test('GET check answers redirects to the purpose form if its answers are missing', async () => {
      const cookie = await reachPurposeScreen(server)

      mockSchemes()
      mockReferenceOptions()

      const response = await server.inject({ method: 'GET', url: CHECK_ANSWERS_URL, headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe(PURPOSE_URL)
    })
  })

  describe('When not logged in', () => {
    test('GET redirects to /', async () => {
      const response = await server.inject({ method: 'GET', url: PURPOSE_URL })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/')
    })
  })
})
