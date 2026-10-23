import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { initiateUploadResponse } from '../../../fixtures/cdp-uploader.js'
import { guidePageResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const SIDE_NAVIGATION = '<nav class="app-side-nav" aria-label="Guidance hub">'

describe('Side navigation', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(() => {
    nock(GUIDANCE_API_BASE_URL).get('/guides').reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
    nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: 'u-1' }))
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  test.each([
    ['the hub', '/hub'],
    ['uploading a guide', '/create-guidance/upload-guide']
  ])('shows on %s when signed in', async (_name, url) => {
    const cookie = await loginAsDevUser(server)

    const { payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

    expect(payload).toContain(SIDE_NAVIGATION)
  })

  test.each([
    ['the hub', '/hub'],
    ['uploading a guide', '/create-guidance/upload-guide']
  ])('takes the place of the header on %s when signed in', async (_name, url) => {
    const cookie = await loginAsDevUser(server)

    const { payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

    expect(payload).not.toContain('class="defra-header')
    expect(payload).not.toContain('defra-service-navigation')
    expect(payload).toMatch(/<nav class="app-side-nav"[^]*class="app-side-nav__logo"[^]*class="app-side-nav__service-link"/)
  })

  test('lets the user sign out from its footer', async () => {
    const cookie = await loginAsDevUser(server)

    const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

    expect(payload).toMatch(/app-side-nav__footer"[^]*href="\/logout"[^>]*>[^<]*Sign out/)
  })

  test('leaves the header on the sign-in page', async () => {
    const { payload } = await server.inject({ method: 'GET', url: '/' })

    expect(payload).toContain('class="defra-header')
  })

  test('does not show on the sign-in page', async () => {
    const { payload } = await server.inject({ method: 'GET', url: '/' })

    expect(payload).toContain('Sign in')
    expect(payload).not.toContain('class="app-side-nav"')
  })
})
