import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { createServer } from '../../../../src/server/server.js'
import { MISSING_ROLES_FLASH_KEY } from '../../../../src/server/access-control/hub-access.js'
import { loginAsDevUser } from '../../helpers/login.js'

const EDITOR_ROUTES = [
  ['GET', '/create-guidance/upload-guide'],
  ['GET', '/create-guidance/upload-guide/processing'],
  ['GET', '/create-guidance/upload-guide/processing/status'],
  ['GET', '/create-guidance/upload-guide/metadata'],
  ['POST', '/create-guidance/upload-guide/metadata'],
  ['GET', '/create-guidance/upload-guide/metadata/purpose'],
  ['POST', '/create-guidance/upload-guide/metadata/purpose'],
  ['GET', '/create-guidance/upload-guide/metadata/check-answers'],
  ['POST', '/create-guidance/upload-guide/metadata/check-answers'],
  ['GET', '/create-guidance/upload-guide/converted'],
  ['GET', '/create-guidance/start-over'],
  ['POST', '/create-guidance/start-over']
]

describe('Access control (Hub.Editor)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    nock.cleanAll()
  })

  async function inject (roles, method, url) {
    vi.stubEnv('DEV_USER_ROLES', roles)
    const cookie = await loginAsDevUser(server)

    return server.inject({ method, url, headers: { cookie }, payload: method === 'POST' ? {} : undefined })
  }

  // Follows a refusal's redirect as the browser would: the login cookie plus
  // whatever the refused response set (the flash lives in that session).
  async function followRedirect (cookie, refused) {
    const set = (refused.headers['set-cookie'] ?? []).map((c) => c.split(';')[0])
    const names = new Set(set.map((c) => c.split('=')[0]))
    const kept = cookie.split('; ').filter((c) => !names.has(c.split('=')[0]))

    return server.inject({
      method: 'GET',
      url: refused.headers.location,
      headers: { cookie: [...kept, ...set].join('; ') }
    })
  }

  test('every create-guidance route in the server is in the list under test', () => {
    const registered = server.table()
      .filter((route) => route.path.startsWith('/create-guidance'))
      .map((route) => `${route.method.toUpperCase()} ${route.path}`)
      .sort()

    expect(registered).toEqual(EDITOR_ROUTES.map(([method, url]) => `${method} ${url}`).sort())
  })

  test.each(EDITOR_ROUTES)('%s %s requires both roles in its route scope', (method, url) => {
    const route = server.table().find((r) => r.path === url && r.method.toUpperCase() === method)

    expect(route.settings.auth.access[0].scope.required.sort()).toEqual(['Hub.Editor', 'Hub.Viewer'])
  })

  describe.each(EDITOR_ROUTES)('%s %s', (method, url) => {
    test('is refused for a viewer without the editor role, with no backend call', async () => {
      const api = nock('http://localhost:3001').persist().get(/.*/).reply(200, {}).post(/.*/).reply(200, {})

      const response = await inject('Hub.Viewer', method, url)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/access-denied/role-required')
      expect(api.pendingMocks().length).toBeGreaterThan(0)
    })

    test.each(['', 'Hub.Other'])('is sent to access-denied for a user with roles "%s"', async (roles) => {
      const response = await inject(roles, method, url)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/access-denied')
    })

    test('is sent to access-denied for an editor without the viewer role', async () => {
      const response = await inject('Hub.Editor', method, url)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/access-denied')
    })

    test('is not refused for a user with both roles', async () => {
      const response = await inject('Hub.Viewer,Hub.Editor', method, url)

      expect(response.statusCode).not.toBe(statusCodes.HTTP_STATUS_FORBIDDEN)
      expect(response.headers.location).not.toBe('/access-denied')
    })
  })

  describe('the role-required page', () => {
    test('explains which role is missing, keeps the side navigation and answers 403', async () => {
      vi.stubEnv('DEV_USER_ROLES', 'Hub.Viewer')
      const cookie = await loginAsDevUser(server)
      const refused = await server.inject({ method: 'GET', url: '/create-guidance/start-over', headers: { cookie } })

      const page = await followRedirect(cookie, refused)

      expect(page.statusCode).toBe(statusCodes.HTTP_STATUS_FORBIDDEN)
      expect(page.payload).toContain('You do not have permission to do this')
      expect(page.payload).toContain('You need the <strong>Designer</strong> role to upload a new guide.')
      expect(page.payload).toContain('app-side-nav')
      expect(page.payload).toContain('href="/logout"')
    })

    test('is shown once: reloading it goes back to the hub', async () => {
      vi.stubEnv('DEV_USER_ROLES', 'Hub.Viewer')
      const cookie = await loginAsDevUser(server)
      const refused = await server.inject({ method: 'GET', url: '/create-guidance/start-over', headers: { cookie } })
      const first = await followRedirect(cookie, refused)

      const again = await followRedirect(cookie, { headers: { ...first.headers, location: '/access-denied/role-required' } })

      expect(again.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(again.headers.location).toBe('/hub')
    })

    test('names every missing role, joined, with "roles" for more than one', async () => {
      // No route needs two roles yet, so a route made for the test refuses as one would.
      server.route({
        method: 'GET',
        path: '/test/refused-for-two-roles',
        options: { auth: { strategy: 'session', access: { scope: false } } },
        handler: (request, h) => {
          request.yar.flash(MISSING_ROLES_FLASH_KEY, { missingRoles: ['Designer', 'Administrator'], reason: 'do both' }, true)
          return h.redirect('/access-denied/role-required')
        }
      })
      vi.stubEnv('DEV_USER_ROLES', 'Hub.Viewer')
      const cookie = await loginAsDevUser(server)
      const refused = await server.inject({ method: 'GET', url: '/test/refused-for-two-roles', headers: { cookie } })

      const page = await followRedirect(cookie, refused)

      expect(page.statusCode).toBe(statusCodes.HTTP_STATUS_FORBIDDEN)
      expect(page.payload).toContain('You need the <strong>Designer and Administrator</strong> roles to do both.')
    })

    test('sends a direct visit with nothing refused to the hub', async () => {
      vi.stubEnv('DEV_USER_ROLES', 'Hub.Viewer')
      const cookie = await loginAsDevUser(server)

      const response = await server.inject({ method: 'GET', url: '/access-denied/role-required', headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/hub')
    })
  })

  describe('side navigation', () => {
    test('is not rendered with an editor section for a viewer', async () => {
      const { payload } = await inject('Hub.Viewer', 'GET', '/hub')

      expect(payload).not.toContain('Designing')
      expect(payload).not.toContain('Upload guidance')
      expect(payload).not.toContain('/create-guidance/upload-guide')
    })

    test('is rendered with an editor section for a user with both roles', async () => {
      const { payload } = await inject('Hub.Viewer,Hub.Editor', 'GET', '/hub')

      expect(payload).toContain('Upload guidance')
      expect(payload).toContain('>Designing</h2>')
    })
  })

  test('a signed-out request is sent to sign in, not told it is forbidden', async () => {
    const response = await server.inject({ method: 'POST', url: '/create-guidance/start-over', payload: {} })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(response.headers.location).toBe('/')
  })
})
