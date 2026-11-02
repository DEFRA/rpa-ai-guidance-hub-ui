import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guidePageResponse, schemesResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'

const SIDE_NAVIGATION = 'app-side-nav'

describe('Access control (Hub.Viewer)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop()
  })

  async function loginWithRoles (roles) {
    vi.stubEnv('DEV_USER_ROLES', roles)

    return loginAsDevUser(server)
  }

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe.each(['', 'Hub.Editor', 'Hub.Other'])('a signed-in user with roles "%s"', (roles) => {
    test.each([
      '/hub',
      '/hub/awaiting-review',
      '/create-guidance/upload-guide',
      '/guides/some-guide'
    ])('GET %s redirects to the access-denied page', async (url) => {
      const cookie = await loginWithRoles(roles)

      const response = await server.inject({ method: 'GET', url, headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/access-denied')
    })

    test('POST requests are redirected to the access-denied page', async () => {
      const cookie = await loginWithRoles(roles)

      const response = await server.inject({
        method: 'POST',
        url: '/side-nav/toggle',
        headers: { cookie },
        payload: { collapsed: 'true', returnTo: '/hub' }
      })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/access-denied')
    })

    test('the access-denied page explains, names who to ask and has no side navigation', async () => {
      const cookie = await loginWithRoles(roles)

      const { statusCode, payload } = await server.inject({ method: 'GET', url: '/access-denied', headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FORBIDDEN)
      expect(payload).toContain('<h1 class="govuk-heading-l">You do not have access to the guidance hub</h1>')
      expect(payload).toContain('You are signed in as dev@example.com')
      expect(payload).toContain('not part of the pilot group')
      expect(payload).toContain(`href="mailto:${config.get('accessRequestEmail')}"`)
      expect(payload).toContain('href="/logout"')
      expect(payload).not.toContain(SIDE_NAVIGATION)
    })

    test('can still sign out', async () => {
      const cookie = await loginWithRoles(roles)

      const response = await server.inject({ method: 'GET', url: '/logout', headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/')
    })
  })

  describe('a signed-in user with Hub.Viewer', () => {
    test('can use the hub', async () => {
      nock(config.get('guidanceApi.baseUrl')).get('/reference/schemes').optionally().reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
      nock(config.get('guidanceApi.baseUrl')).get('/guides').reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
      const cookie = await loginWithRoles('Hub.Viewer')

      const { statusCode } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(statusCode).not.toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })

    test('is redirected from the access-denied page to the hub', async () => {
      const cookie = await loginWithRoles('Hub.Editor,Hub.Viewer')

      const response = await server.inject({ method: 'GET', url: '/access-denied', headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/hub')
    })
  })

  describe('routes that need no role', () => {
    test.each(['/health', '/', '/favicon.ico'])('%s is still reachable when signed out', async (url) => {
      const { statusCode } = await server.inject({ method: 'GET', url })

      expect(statusCode).toBeLessThan(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('the access-denied page needs a sign-in', async () => {
      const response = await server.inject({ method: 'GET', url: '/access-denied' })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/')
    })
  })

  describe('with AUTH_REQUIRE_VIEWER_ROLE off', () => {
    let openServer
    const original = config.get('auth.requireViewerRole')

    beforeAll(async () => {
      config.set('auth.requireViewerRole', false)
      openServer = await createServer()
      await openServer.initialize()
    })

    afterAll(async () => {
      config.set('auth.requireViewerRole', original)
      await openServer.stop()
    })

    test('a user without Hub.Viewer can use the hub', async () => {
      vi.stubEnv('DEV_USER_ROLES', '')
      const cookie = await loginAsDevUser(openServer)
      nock(config.get('guidanceApi.baseUrl')).get('/reference/schemes').optionally().reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
      nock(config.get('guidanceApi.baseUrl')).get('/guides').reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())

      const { statusCode } = await openServer.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })

    test('the access-denied page sends them on to the hub', async () => {
      vi.stubEnv('DEV_USER_ROLES', '')
      const cookie = await loginAsDevUser(openServer)

      const response = await openServer.inject({ method: 'GET', url: '/access-denied', headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/hub')
    })
  })
})
