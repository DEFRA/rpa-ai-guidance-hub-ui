import Boom from '@hapi/boom'
import Hapi from '@hapi/hapi'

import { config } from '../../../../src/config/config.js'
import { describeRefusal } from '../../../../src/server/access-control/describe-refusal.js'
import { ACCESS_DENIED_PATH, ROLE_REQUIRED_PATH, canUseHub } from '../../../../src/server/access-control/hub-access.js'
import { requireRoles } from '../../../../src/server/access-control/require-roles.js'

describe('canUseHub', () => {
  const session = (roles) => ({ roles, profile: { roles } })
  const original = config.get('auth.enforceRoles')

  afterEach(() => {
    config.set('auth.enforceRoles', original)
  })

  test('is off by default', () => {
    expect(config.default('auth.enforceRoles')).toBe(false)
  })

  test('requires Hub.Viewer when the flag is on', () => {
    config.set('auth.enforceRoles', true)

    expect(canUseHub(session(['Hub.Viewer']))).toBe(true)
    expect(canUseHub(session(['Hub.Editor']))).toBe(false)
  })

  test('lets any signed-in user in when the flag is off', () => {
    config.set('auth.enforceRoles', false)

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
      request.response.isBoom && describeRefusal(request)?.redirectTo ? h.redirect(ACCESS_DENIED_PATH) : h.continue
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

describe('requireRoles', () => {
  const original = config.get('auth.enforceRoles')

  afterEach(() => {
    config.set('auth.enforceRoles', original)
  })

  test('asks for the listed roles plus Hub.Viewer while Viewer enforcement is on', () => {
    config.set('auth.enforceRoles', true)

    expect(requireRoles('Hub.Editor')).toEqual({
      strategy: 'session',
      access: { scope: ['+Hub.Editor', '+Hub.Viewer'] }
    })
  })

  test('asks for no role at all when roles are not enforced', () => {
    config.set('auth.enforceRoles', false)

    expect(requireRoles('Hub.Editor')).toEqual({ strategy: 'session' })
  })

  test('does not repeat Hub.Viewer when the route lists it', () => {
    config.set('auth.enforceRoles', true)

    expect(requireRoles('Hub.Viewer', 'Hub.Editor').access.scope).toEqual(['+Hub.Viewer', '+Hub.Editor'])
  })
})

describe('describeRefusal', () => {
  const original = config.get('auth.enforceRoles')

  beforeEach(() => {
    config.set('auth.enforceRoles', true)
  })

  afterEach(() => {
    config.set('auth.enforceRoles', original)
  })

  async function refusalFor (roles, auth, path = '/gated', reason) {
    const server = Hapi.server()
    let refusal

    server.auth.scheme('test', () => ({
      authenticate: (_request, h) => h.authenticated({ credentials: { roles, scope: roles } })
    }))
    server.auth.strategy('session', 'test')
    server.auth.default({ strategy: 'session', access: { scope: ['Hub.Viewer'] } })
    server.ext('onPreResponse', (request, h) => {
      refusal = request.response.isBoom ? describeRefusal(request) : undefined

      return h.continue
    })
    server.route([
      { method: 'GET', path: '/gated', options: { auth, app: { roleRequiredReason: reason } }, handler: () => 'ok' },
      { method: 'GET', path: '/default', handler: () => 'ok' }
    ])

    const response = await server.inject(path)

    return { refusal, statusCode: response.statusCode }
  }

  test('names the missing role by its display name', async () => {
    const { refusal, statusCode } = await refusalFor(['Hub.Viewer'], requireRoles('Hub.Editor'))

    expect(statusCode).toBe(403)
    expect(refusal).toEqual({ redirectTo: ROLE_REQUIRED_PATH, missingRoles: ['Designer'], reason: 'do this' })
  })

  test('carries the reason the route gives', async () => {
    const { refusal } = await refusalFor(['Hub.Viewer'], requireRoles('Hub.Editor'), '/gated', 'upload a new guide')

    expect(refusal.reason).toBe('upload a new guide')
  })

  test('leaves out a missing role the hub does not name', async () => {
    const { refusal } = await refusalFor(['Hub.Viewer'], requireRoles('Hub.Auditor', 'Hub.Editor'))

    expect(refusal.missingRoles).toEqual(['Designer'])
  })

  test.each([[[]], [['Hub.Editor']]])('redirects a user without Hub.Viewer (roles %j)', async (roles) => {
    const { refusal } = await refusalFor(roles, requireRoles('Hub.Editor'))

    expect(refusal).toEqual({ redirectTo: ACCESS_DENIED_PATH })
  })

  test('is null when the user holds the roles', async () => {
    const { refusal, statusCode } = await refusalFor(['Hub.Viewer', 'Hub.Editor'], requireRoles('Hub.Editor'))

    expect(statusCode).toBe(200)
    expect(refusal).toBeUndefined()
  })

  test('is null for a 403 on a route with no scope', async () => {
    const { refusal } = await refusalFor(['Hub.Viewer'], { strategy: 'session' }, '/gated')

    expect(refusal).toBeUndefined()
  })
})
