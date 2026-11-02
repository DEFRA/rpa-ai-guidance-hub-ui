import Boom from '@hapi/boom'
import Hapi from '@hapi/hapi'

import { config } from '../../../src/config/config.js'
import { ACCESS_DENIED_PATH, canUseHub, hasViewerRole, isRefusedForViewerRole } from '../../../src/server/access-control.js'

describe('hasViewerRole', () => {
  test.each([
    [['Hub.Viewer'], true],
    [['Hub.Editor', 'Hub.Viewer'], true],
    [['Hub.Editor'], false],
    [[], false]
  ])('roles %j -> %s', (roles, expected) => {
    expect(hasViewerRole({ roles, profile: { roles } })).toBe(expected)
  })
})

describe('canUseHub', () => {
  const session = (roles) => ({ roles, profile: { roles } })
  const original = config.get('auth.requireViewerRole')

  afterEach(() => {
    config.set('auth.requireViewerRole', original)
  })

  test('is off by default', () => {
    expect(config.default('auth.requireViewerRole')).toBe(false)
  })

  test('requires Hub.Viewer when the flag is on', () => {
    config.set('auth.requireViewerRole', true)

    expect(canUseHub(session(['Hub.Viewer']))).toBe(true)
    expect(canUseHub(session(['Hub.Editor']))).toBe(false)
  })

  test('lets any signed-in user in when the flag is off', () => {
    config.set('auth.requireViewerRole', false)

    expect(canUseHub(session([]))).toBe(true)
  })
})

describe('Hub.Viewer default scope', () => {
  // Mirrors the app's wiring: a default Viewer scope, routes opting out with
  // `scope: false`, and an onPreResponse that redirects refused page views.
  const handler = vi.fn(() => 'ok')

  async function serverFor (credentials) {
    const server = Hapi.server()

    server.auth.scheme('test', () => ({
      authenticate: (_request, h) =>
        credentials
          ? h.authenticated({ credentials: { ...credentials, scope: credentials.roles } })
          : h.unauthenticated(Boom.unauthorized())
    }))
    server.auth.strategy('test', 'test')
    server.auth.default({ strategy: 'test', access: { scope: ['Hub.Viewer'] } })
    server.ext('onPreResponse', (request, h) =>
      request.response.isBoom && isRefusedForViewerRole(request) ? h.redirect(ACCESS_DENIED_PATH) : h.continue
    )
    server.route([
      { method: ['GET', 'POST'], path: '/page', handler },
      { method: 'GET', path: '/exempt', options: { auth: { access: { scope: false } } }, handler: () => 'ok' },
      { method: 'GET', path: '/public', options: { auth: false }, handler: () => 'ok' },
      {
        method: 'GET',
        path: '/public-forbidden',
        options: { auth: false },
        handler: () => { throw Boom.forbidden() }
      }
    ])

    return server
  }

  test('lets a viewer through', async () => {
    const server = await serverFor({ roles: ['Hub.Viewer'] })

    expect((await server.inject('/page')).statusCode).toBe(200)
  })

  test.each([[[]], [['Hub.Editor']]])('redirects a page view from a user with roles %j', async (roles) => {
    const server = await serverFor({ roles })
    const response = await server.inject('/page')

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(ACCESS_DENIED_PATH)
  })

  test('redirects a POST from a user without the role, without running the handler', async () => {
    const server = await serverFor({ roles: ['Hub.Editor'] })
    const response = await server.inject({ method: 'POST', url: '/page' })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(ACCESS_DENIED_PATH)
    expect(handler).not.toHaveBeenCalled()
  })

  test('skips routes that opt out of the scope', async () => {
    const server = await serverFor({ roles: [] })

    expect((await server.inject('/exempt')).statusCode).toBe(200)
  })

  test('never checks the role of a signed-out user', async () => {
    const server = await serverFor(null)

    expect((await server.inject('/page')).statusCode).toBe(401)
    expect((await server.inject('/public')).statusCode).toBe(200)
  })

  test('leaves a 403 for a signed-out user as a 403', async () => {
    const server = await serverFor(null)

    expect((await server.inject('/public-forbidden')).statusCode).toBe(403)
  })
})
