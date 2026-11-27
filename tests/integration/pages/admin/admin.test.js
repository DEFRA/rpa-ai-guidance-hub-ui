import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { findTheUserInTheApi } from '../../helpers/admin-api.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf, sideNavOf } from '../../helpers/page.js'
import {
  guidePageResponse,
  schemesResponse
} from '../../../fixtures/guidance-api.js'

const ADMIN_ROUTES = [
  ['GET', '/admin/search-index'],
  ['GET', '/admin/search-index/rebuild'],
  ['POST', '/admin/search-index/rebuild'],
  ['GET', '/admin/search-index/delete'],
  ['POST', '/admin/search-index/delete']
]

describe('Admin area (Hub.Admin)', () => {
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

  async function login (roles) {
    vi.stubEnv('DEV_USER_ROLES', roles)

    return loginAsDevUser(server)
  }

  async function inject (roles, method, url) {
    return injectWith(await login(roles), method, url)
  }

  function injectWith (cookie, method, url) {
    return server.inject({
      method,
      url,
      headers: { cookie },
      payload: method === 'POST' ? {} : undefined
    })
  }

  function mockTheHub () {
    nock(config.get('guidanceApi.baseUrl'))
      .get('/reference/schemes')
      .optionally()
      .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
    nock(config.get('guidanceApi.baseUrl'))
      .get('/guides')
      .query(true)
      .optionally()
      .reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
  }

  test('every admin route in the server is in the list under test', () => {
    const registered = server.table()
      .filter((route) => route.path === '/admin' || route.path.startsWith('/admin/'))
      .map((route) => `${route.method.toUpperCase()} ${route.path}`)
      .sort()

    expect(registered)
      .toEqual(ADMIN_ROUTES.map(([method, url]) => `${method} ${url}`).sort())
  })

  test.each(ADMIN_ROUTES)('%s %s requires both roles in its route scope', (method, url) => {
    const route = server.table()
      .find((r) => r.path === url && r.method.toUpperCase() === method)

    expect(route.settings.auth.access[0].scope.required.sort())
      .toEqual(['Hub.Admin', 'Hub.Viewer'])
  })

  describe.each(ADMIN_ROUTES)('%s %s', (method, url) => {
    test('is refused for a maintainer without the administrator role, with no backend call', async () => {
      const cookie = await login('Hub.Viewer,Hub.Editor')
      const backendRequests = []
      const record = (uri) => {
        backendRequests.push(uri)

        return {}
      }
      nock(config.get('guidanceApi.baseUrl'))
        .persist()
        .get(/.*/).reply(200, record)
        .post(/.*/).reply(200, record)
        .delete(/.*/).reply(200, record)

      const response = await injectWith(cookie, method, url)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/access-denied/role-required')
      expect(backendRequests).toEqual([])
    })

    test('is sent to access-denied for an administrator without the viewer role', async () => {
      const response = await inject('Hub.Admin', method, url)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/access-denied')
    })
  })

  describe('side navigation', () => {
    test('has no admin section for a maintainer', async () => {
      mockTheHub()

      const { payload } = await inject('Hub.Viewer,Hub.Editor', 'GET', '/hub')

      const nav = sideNavOf(pageOf(payload))
      expect(nav.queryByRole('heading', { name: 'Administration' }))
        .not.toBeInTheDocument()
      expect(nav.queryByRole('link', { name: 'Index management' })).not.toBeInTheDocument()
    })

    test('links an administrator to index management', async () => {
      mockTheHub()

      const { payload } = await inject('Hub.Viewer,Hub.Admin', 'GET', '/hub')

      const nav = sideNavOf(pageOf(payload))
      expect(nav.getByRole('heading', { level: 2, name: 'Administration' }))
        .toBeInTheDocument()
      expect(nav.getByRole('link', { name: 'Index management' }))
        .toHaveAttribute('href', '/admin/search-index')
    })

    test('marks Index management as the current page on its pages', async () => {
      const { payload } = await inject('Hub.Viewer,Hub.Admin', 'GET', '/admin/search-index')

      expect(sideNavOf(pageOf(payload)).getByRole('link', { name: 'Index management' }))
        .toHaveAttribute('aria-current', 'page')
    })
  })

  describe('with AUTH_ENFORCE_ROLES off', () => {
    let openServer
    const original = config.get('auth.enforceRoles')

    beforeAll(async () => {
      config.set('auth.enforceRoles', false)
      openServer = await createServer()
      await openServer.initialize()
    })

    afterAll(async () => {
      config.set('auth.enforceRoles', original)
      await openServer.stop()
    })

    test('a user with no roles gets index management', async () => {
      vi.stubEnv('DEV_USER_ROLES', '')
      findTheUserInTheApi()
      const cookie = await loginAsDevUser(openServer)

      const response = await openServer.inject({ method: 'GET', url: '/admin/search-index', headers: { cookie } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })
  })
})
