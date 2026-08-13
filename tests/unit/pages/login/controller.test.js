import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mockLoggerWarn = vi.fn()

vi.mock('../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockLoggerWarn })
}))

const originalEnv = { ...process.env }

async function buildController () {
  const { getLogin, handleLoginCallback, logout } = await import('../../../../src/pages/login/controller.js')
  return { getLogin, handleLoginCallback, logout }
}

function buildRequest (overrides = {}) {
  return {
    yar: { set: vi.fn(), get: vi.fn(), reset: vi.fn(), id: 'test-session-id' },
    cookieAuth: { set: vi.fn(), clear: vi.fn() },
    auth: { isAuthenticated: false, credentials: {} },
    server: { verifyEntraToken: vi.fn() },
    ...overrides
  }
}

function buildH () {
  return {
    view: vi.fn((tpl, ctx) => ({ tpl, ctx })),
    redirect: vi.fn((location) => ({ redirectedTo: location }))
  }
}

describe('#login controller', () => {
  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
    mockLoggerWarn.mockClear()
  })

  describe('#getLogin', () => {
    test('Should render the login view with the expected page title', async () => {
      const { getLogin } = await buildController()
      const request = buildRequest()
      const h = buildH()

      await getLogin(request, h)

      expect(h.view).toHaveBeenCalledWith('login/login.njk', { pageTitle: 'Sign in' })
    })
  })

  describe('#handleLoginCallback with local provider', () => {
    beforeEach(() => {
      process.env.AUTH_PROVIDER = 'local'
      vi.resetModules()
    })

    test('Should store the dev-session profile and jwt in yar, set cookieAuth, and redirect to /', async () => {
      const { handleLoginCallback } = await buildController()
      const request = buildRequest()
      const h = buildH()

      await handleLoginCallback(request, h)

      expect(request.yar.set).toHaveBeenCalledTimes(1)
      const [key, value] = request.yar.set.mock.calls[0]
      expect(key).toBe('userAuth')
      expect(value).toMatchObject({
        token: expect.any(String),
        profile: expect.objectContaining({
          id: 'dev-user-123'
        })
      })

      expect(request.cookieAuth.set).toHaveBeenCalledWith({ sessionId: 'test-session-id' })
      expect(h.redirect).toHaveBeenCalledWith('/')
    })
  })

  describe('#handleLoginCallback with entra provider', () => {
    beforeEach(() => {
      process.env.AUTH_PROVIDER = 'entra'
      vi.resetModules()
    })

    test('Should throw "Authentication failed" when request.auth.isAuthenticated is false', async () => {
      const { handleLoginCallback } = await buildController()
      const request = buildRequest({ auth: { isAuthenticated: false } })
      const h = buildH()

      await expect(handleLoginCallback(request, h)).rejects.toThrow('Authentication failed')

      expect(request.yar.set).not.toHaveBeenCalled()
      expect(request.cookieAuth.set).not.toHaveBeenCalled()
    })

    test('Should log warning and throw generic error when verifyEntraToken rejects, without leaking the original error message', async () => {
      const { handleLoginCallback } = await buildController()
      const originalError = new Error('signature mismatch: verification failed')
      const sessionValue = 'abc123def456'
      const idValue = 'xyz789uvw012'
      const request = buildRequest({
        auth: {
          isAuthenticated: true,
          credentials: {
            profile: { displayName: 'Test User' },
            token: sessionValue,
            idToken: idValue
          }
        }
      })
      request.server.verifyEntraToken.mockRejectedValue(originalError)
      const h = buildH()

      const error = await handleLoginCallback(request, h).catch(e => e)

      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Authentication failed')
      expect(error.message).not.toContain('signature mismatch')

      expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
      const [logPayload] = mockLoggerWarn.mock.calls[0]
      expect(logPayload).toMatchObject({
        event: expect.objectContaining({
          type: 'entra_token_verification_failed',
          outcome: 'failure'
        }),
        error: expect.objectContaining({
          message: 'signature mismatch: verification failed'
        })
      })

      expect(request.yar.set).not.toHaveBeenCalled()
      expect(request.cookieAuth.set).not.toHaveBeenCalled()
    })

    test('Should store profile and session value, set cookieAuth, and redirect to / when verifyEntraToken resolves', async () => {
      const { handleLoginCallback } = await buildController()
      const sessionValue = 'abc123def456'
      const idValue = 'xyz789uvw012'
      const credentials = {
        profile: { displayName: 'Test User', id: 'user-123' },
        token: sessionValue,
        idToken: idValue
      }
      const request = buildRequest({
        auth: {
          isAuthenticated: true,
          credentials
        }
      })
      request.server.verifyEntraToken.mockResolvedValue({ /* decoded payload */ })
      const h = buildH()

      await handleLoginCallback(request, h)

      expect(request.server.verifyEntraToken).toHaveBeenCalledWith(idValue)

      expect(request.yar.set).toHaveBeenCalledWith(
        'userAuth',
        {
          token: sessionValue,
          profile: { displayName: 'Test User', id: 'user-123' }
        }
      )
      expect(request.yar.set.mock.calls[0][1]).not.toHaveProperty('idToken')

      expect(request.cookieAuth.set).toHaveBeenCalledWith({ sessionId: 'test-session-id' })
      expect(h.redirect).toHaveBeenCalledWith('/')
    })
  })

  describe('#logout', () => {
    test('Should reset yar, clear cookieAuth, and redirect to /', async () => {
      const { logout } = await buildController()
      const request = buildRequest()
      const h = buildH()

      await logout(request, h)

      expect(request.yar.reset).toHaveBeenCalled()
      expect(request.cookieAuth.clear).toHaveBeenCalled()
      expect(h.redirect).toHaveBeenCalledWith('/')
    })
  })
})
