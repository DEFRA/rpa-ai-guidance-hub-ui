import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockLoggerWarn, mockLoggerError } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn()
}))

vi.mock('../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({
    warn: mockLoggerWarn,
    error: mockLoggerError
  })
}))

const credentials = {
  profile: {
    displayName: 'Test User',
    id: 'user-123'
  },
  token: 'abc123def456',
  idToken: 'xyz789uvw012',
  refreshToken: 'refresh-token-abc'
}

async function getHandleLoginCallback () {
  const controller = await import(
    '../../../../src/pages/login/controller.js'
  )

  return controller.handleLoginCallback
}

function buildRequest (overrides = {}) {
  return {
    cookieAuth: {
      set: vi.fn()
    },
    auth: {
      isAuthenticated: false,
      credentials: {}
    },
    server: {
      verifyEntraToken: vi.fn(),
      app: {
        cache: {
          set: vi.fn()
        }
      }
    },
    ...overrides
  }
}

function buildAuthenticatedRequest () {
  return buildRequest({
    auth: {
      isAuthenticated: true,
      credentials
    }
  })
}

function buildResponseToolkit () {
  return {
    view: vi.fn((template, context) => ({
      template,
      context
    })),
    redirect: vi.fn((location) => ({
      redirectedTo: location
    }))
  }
}

function expectSessionNotCreated (request) {
  expect(request.server.app.cache.set).not.toHaveBeenCalled()
  expect(request.cookieAuth.set).not.toHaveBeenCalled()
}

describe('#loginController', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_PROVIDER', 'entra')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  describe('#handleLoginCallback with entra provider', () => {
    test('throws when authentication has failed', async () => {
      const handleLoginCallback = await getHandleLoginCallback()
      const request = buildRequest()
      const h = buildResponseToolkit()

      await expect(
        handleLoginCallback(request, h)
      ).rejects.toThrow(/^Authentication failed$/)

      expectSessionNotCreated(request)
    })

    test('logs a warning and hides token verification errors', async () => {
      const handleLoginCallback = await getHandleLoginCallback()
      const request = buildAuthenticatedRequest()
      const h = buildResponseToolkit()

      request.server.verifyEntraToken.mockRejectedValue(
        new Error('signature mismatch: verification failed')
      )

      await expect(
        handleLoginCallback(request, h)
      ).rejects.toThrow(/^Token verification failed$/)

      expect(mockLoggerWarn).toHaveBeenCalledOnce()
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            type: 'entra_token_verification_failed',
            outcome: 'failure'
          }),
          error: expect.objectContaining({
            message: 'signature mismatch: verification failed'
          })
        })
      )

      expectSessionNotCreated(request)
    })

    describe('when token verification succeeds', () => {
      let handleLoginCallback
      let request
      let h
      let result

      beforeEach(async () => {
        handleLoginCallback = await getHandleLoginCallback()
        request = buildAuthenticatedRequest()
        h = buildResponseToolkit()

        request.server.verifyEntraToken.mockResolvedValue({})

        result = await handleLoginCallback(request, h)
      })

      test('verifies the ID token', () => {
        expect(request.server.verifyEntraToken).toHaveBeenCalledOnce()
        expect(request.server.verifyEntraToken).toHaveBeenCalledWith(
          credentials.idToken
        )
      })

      test('stores the authenticated session', () => {
        expect(request.server.app.cache.set).toHaveBeenCalledOnce()

        const [sessionId, storedSession] = request.server.app.cache.set.mock.calls[0]

        expect(sessionId).toMatch(/^auth-session:/)
        expect(storedSession).toEqual({
          token: credentials.token,
          profile: credentials.profile,
          refreshToken: credentials.refreshToken
        })
      })

      test('sets the authentication cookie to the stored session ID', () => {
        const [cacheKey] = request.server.app.cache.set.mock.calls[0]
        const storedSessionId = cacheKey.replace(/^auth-session:/, '')

        expect(request.cookieAuth.set).toHaveBeenCalledOnce()
        expect(request.cookieAuth.set).toHaveBeenCalledWith({
          sessionId: storedSessionId
        })
      })

      test('redirects to the home page', () => {
        expect(h.redirect).toHaveBeenCalledOnce()
        expect(h.redirect).toHaveBeenCalledWith('/')
        expect(result).toEqual({
          redirectedTo: '/'
        })
      })
    })
  })
})
