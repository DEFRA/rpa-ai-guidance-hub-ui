import { randomUUID } from 'node:crypto'
import Http from 'node:http'
import Https from 'node:https'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import Hapi from '@hapi/hapi'
import HapiCookie from '@hapi/cookie'
import Wreck from '@hapi/wreck'
import nock from 'nock'

import { generateEntraJwt, getJwks, ENTRA_TEST_KID } from '../../../utils/oidc.js'

const { mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn()
}))

vi.mock('../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn()
  })
}))

const originalEnv = { ...process.env }

// Not a real credential - Bell just requires the client secret to be a
// non-empty string, hence the deliberately-obvious placeholder text.
const ENTRA_TEST_FIXTURE_VALUE = 'not-a-real-value-used-only-in-tests'

/**
 * Boots a minimal Hapi server with the real `auth` plugin registered -
 * enough to observe which strategy/decoration it sets up for the currently
 * configured `AUTH_PROVIDER`, without exercising a real request (Bell/JWKS
 * do no I/O at registration time).
 */
async function buildServer () {
  const { auth } = await import('../../../../src/server/plugins/auth.js')

  const server = Hapi.server()

  await server.register(HapiCookie)
  await server.register(auth)

  return server
}

/**
 * Boots a real Hapi server with the 'session' auth strategy wired up exactly
 * as it is in the app (auth plugin plus a real cache engine), plus two
 * throwaway routes so `_validateSessionToken` can be exercised end-to-end
 * via `server.inject` rather than exported and unit tested directly.
 */
async function buildServerWithSession () {
  const { auth } = await import('../../../../src/server/plugins/auth.js')
  const { getCacheEngine } = await import('../../../../src/server/plugins/session-cache/cache-engine.js')
  const { config } = await import('../../../../src/config/config.js')

  const server = Hapi.server({
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine(config.get('session.cache.engine'))
      }
    ]
  })

  server.app.cache = server.cache({
    cache: config.get('session.cache.name'),
    segment: 'auth-session',
    expiresIn: config.get('session.cache.ttl')
  })

  await server.register(HapiCookie)
  await server.register(auth)

  // Mimics the relevant part of the real `/login/callback` handler (see
  // `pages/login/controller.js`) closely enough to populate a real session,
  // without pulling in the whole login page/router just to authenticate a
  // test request. Omitting `token` reproduces a cookieAuth cookie that has
  // outlived its cached session data (e.g. the cache entry expired or was
  // evicted independently of the cookie).
  server.route({
    method: 'GET',
    path: '/test-login',
    options: { auth: false },
    handler: async (request) => {
      const sessionId = randomUUID()

      if (request.query.token) {
        await request.server.app.cache.set(`auth-session:${sessionId}`, {
          token: request.query.token,
          refreshToken: request.query.refreshToken,
          profile: { id: 'user-123' }
        })
      }

      request.cookieAuth.set({ sessionId })

      return 'ok'
    }
  })

  server.route({
    method: 'GET',
    path: '/protected',
    options: { auth: 'session' },
    handler: (request) => request.auth.credentials
  })

  await server.initialize()

  return server
}

/**
 * Logs in to a `buildServerWithSession` server and returns a `Cookie` header
 * value carrying the authenticated session, for use in a subsequent
 * `server.inject` call. Omit `token` to set the cookieAuth cookie without a
 * corresponding cached session.
 *
 * @param {import('@hapi/hapi').Server} server
 * @param {string} [token]
 * @param {string} [refreshToken]
 * @returns {Promise<string>}
 */
async function loginWithToken (server, token, refreshToken) {
  const params = new URLSearchParams()

  if (token) {
    params.append('token', token)
  }

  if (refreshToken) {
    params.append('refreshToken', refreshToken)
  }

  const query = params.size ? `?${params.toString()}` : ''

  const response = await server.inject({
    method: 'GET',
    url: `/test-login${query}`
  })

  return (response.headers['set-cookie'] ?? [])
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

describe('#auth', () => {
  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  describe('When AUTH_PROVIDER is "local"', () => {
    beforeEach(() => {
      process.env.AUTH_PROVIDER = 'local'
      vi.resetModules()
    })

    test('Should not set up the entra strategy or verifyEntraToken', async () => {
      const server = await buildServer()

      expect(server.verifyEntraToken).toBeUndefined()
      expect(() =>
        server.route({
          method: 'GET',
          path: '/uses-entra',
          options: { auth: 'entra' },
          handler: () => 'ok'
        })
      ).toThrow(/Unknown authentication strategy entra/)
    })
  })

  describe('When AUTH_PROVIDER is "entra"', () => {
    beforeEach(() => {
      process.env.AUTH_PROVIDER = 'entra'
      process.env.ENTRA_TENANT_ID = ENTRA_TEST_FIXTURE_VALUE
      process.env.ENTRA_CLIENT_ID = ENTRA_TEST_FIXTURE_VALUE
      process.env.ENTRA_CLIENT_SECRET = ENTRA_TEST_FIXTURE_VALUE
      process.env.ENTRA_REDIRECT_HOST = 'http://localhost:3000'
      vi.resetModules()
    })

    test('Should set up the entra strategy and verifyEntraToken', async () => {
      const server = await buildServer()

      expect(typeof server.verifyEntraToken).toBe('function')
      expect(() =>
        server.route({
          method: 'GET',
          path: '/uses-entra',
          options: { auth: 'entra' },
          handler: () => 'ok'
        })
      ).not.toThrow()
    })

    test('Should point Wreck at the global http/https agents, so bell requests honour the egress proxy', async () => {
      await buildServer()

      expect(Wreck.agents.http).toBe(Http.globalAgent)
      expect(Wreck.agents.https).toBe(Https.globalAgent)
    })

    describe('#server.verifyEntraToken', () => {
      beforeEach(() => {
        nock.disableNetConnect()
      })

      afterEach(() => {
        nock.cleanAll()
        nock.enableNetConnect()
      })

      test('Should resolve with the decoded payload for a validly-signed token with matching kid, aud and iss', async () => {
        const server = await buildServer()
        const token = generateEntraJwt()

        nock('https://login.microsoftonline.com')
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .reply(200, getJwks())

        const result = await server.verifyEntraToken(token)

        expect(result).toMatchObject({
          aud: ENTRA_TEST_FIXTURE_VALUE,
          iss: `https://login.microsoftonline.com/${ENTRA_TEST_FIXTURE_VALUE}/v2.0`,
          sub: 'user-id'
        })
      })

      test('Should reject when the signature does not match the resolved public key', async () => {
        const server = await buildServer()
        const token = generateEntraJwt()

        // Serve a JWKS with a different key under the same kid
        nock('https://login.microsoftonline.com')
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .reply(200, {
            keys: [
              {
                kty: 'RSA',
                kid: ENTRA_TEST_KID,
                use: 'sig',
                n: 'xGOr-H7A-PWLt',
                e: 'AQAB'
              }
            ]
          })

        await expect(server.verifyEntraToken(token)).rejects.toThrow()
      })

      test('Should reject when the audience does not match the configured Entra client ID', async () => {
        const server = await buildServer()
        const token = generateEntraJwt({ aud: 'wrong-client-id' })

        nock('https://login.microsoftonline.com')
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .reply(200, getJwks())

        await expect(server.verifyEntraToken(token)).rejects.toThrow()
      })

      test('Should reject when the issuer does not match the configured authority/tenant', async () => {
        const server = await buildServer()
        const token = generateEntraJwt({
          iss: 'https://login.microsoftonline.com/wrong-tenant-id/v2.0'
        })

        nock('https://login.microsoftonline.com')
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .reply(200, getJwks())

        await expect(server.verifyEntraToken(token)).rejects.toThrow()
      })

      test('Should reject when the JWKS response has no key matching the token kid', async () => {
        const server = await buildServer()
        const token = generateEntraJwt({ kid: 'unknown-kid' }, { kid: 'unknown-kid' })

        nock('https://login.microsoftonline.com')
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .reply(200, getJwks({ kid: 'different-kid' }))

        await expect(server.verifyEntraToken(token)).rejects.toThrow()
      })

      test('Should reject when the JWKS endpoint returns an error', async () => {
        const server = await buildServer()
        const token = generateEntraJwt()

        nock('https://login.microsoftonline.com')
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .reply(500, { error: 'Internal Server Error' })

        await expect(server.verifyEntraToken(token)).rejects.toThrow()
      })

      test('Should request keys from a custom ENTRA_AUTHORITY_HOST', async () => {
        const customAuthority = 'https://custom.login.example.com'
        process.env.ENTRA_AUTHORITY_HOST = customAuthority
        vi.resetModules()

        const server = await buildServer()

        const token = generateEntraJwt({
          iss: `${customAuthority}/${ENTRA_TEST_FIXTURE_VALUE}/v2.0`
        })

        nock(customAuthority)
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .reply(200, getJwks())

        const result = await server.verifyEntraToken(token)

        expect(result).toBeDefined()
        expect(result.aud).toBe(ENTRA_TEST_FIXTURE_VALUE)
      })

      test('Should cache JWKS keys across multiple token verifications with the same kid', async () => {
        const server = await buildServer()
        const token1 = generateEntraJwt()
        const token2 = generateEntraJwt({ sub: 'user-2' })

        nock('https://login.microsoftonline.com')
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .once()
          .reply(200, getJwks())

        await server.verifyEntraToken(token1)

        const result = await server.verifyEntraToken(token2)

        expect(result).toBeDefined()
        expect(result.sub).toBe('user-2')
      })

      test('Should reject with expired token', async () => {
        const server = await buildServer()
        const expiredToken = generateEntraJwt({
          exp: Math.floor(Date.now() / 1000) - 3600
        })

        nock('https://login.microsoftonline.com')
          .get(`/${ENTRA_TEST_FIXTURE_VALUE}/discovery/v2.0/keys`)
          .reply(200, getJwks())

        await expect(server.verifyEntraToken(expiredToken)).rejects.toThrow()
      })

      test('Should reject when token has malformed structure', async () => {
        const server = await buildServer()

        await expect(
          server.verifyEntraToken('malformed.jwt')
        ).rejects.toThrow()
      })
    })
  })

  describe('when session auth strategy is used', () => {
    let server

    beforeEach(async () => {
      server = await buildServerWithSession()
    })

    afterEach(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should redirect to /login when the request has no session', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/protected'
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/login')
    })

    test('Should redirect to /login when the session cookie is valid but has no stored userAuth', async () => {
      const cookie = await loginWithToken(server)

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie }
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/login')
    })

    test('Should authenticate the request when the session holds a non-expired token', async () => {
      const token = generateEntraJwt()
      const cookie = await loginWithToken(server, token)

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie }
      })

      expect(statusCode).toBe(200)
      expect(result).toMatchObject({
        token,
        profile: { id: 'user-123' },
        sessionId: expect.any(String)
      })
    })

    test('Should redirect to /login and log when the session token has expired and refresh tokens are disabled', async () => {
      const expiredToken = generateEntraJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })
      const cookie = await loginWithToken(server, expiredToken)

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie }
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/login')
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        { type: 'entra_token_expired', error: expect.any(Error) },
        'Session token invalid and cannot be refreshed'
      )
    })
  })

  describe('when session auth strategy is used with ENTRA_USE_REFRESH_TOKENS overridden to true', () => {
    let server

    beforeEach(async () => {
      process.env.ENTRA_USE_REFRESH_TOKENS = 'true'
      process.env.ENTRA_TENANT_ID = ENTRA_TEST_FIXTURE_VALUE
      process.env.ENTRA_CLIENT_ID = ENTRA_TEST_FIXTURE_VALUE
      process.env.ENTRA_CLIENT_SECRET = ENTRA_TEST_FIXTURE_VALUE
      vi.resetModules()

      server = await buildServerWithSession()
    })

    afterEach(async () => {
      await server.stop({ timeout: 0 })
      nock.cleanAll()
    })

    test('Should refresh the expired session token and authenticate the request', async () => {
      const expiredToken = generateEntraJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })
      const cookie = await loginWithToken(server, expiredToken, 'old-refresh-token')

      const refreshScope = nock('https://login.microsoftonline.com')
        .post(`/${ENTRA_TEST_FIXTURE_VALUE}/oauth2/v2.0/token`, (body) => {
          const params = new URLSearchParams(body)

          return params.get('client_id') === ENTRA_TEST_FIXTURE_VALUE &&
            params.get('client_secret') === ENTRA_TEST_FIXTURE_VALUE &&
            params.get('grant_type') === 'refresh_token' &&
            params.get('scope') === 'User.Read openid profile email' &&
            params.get('refresh_token') === 'old-refresh-token'
        })
        .reply(200, { access_token: 'new-access-token', refresh_token: 'new-refresh-token' })

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie }
      })

      expect(statusCode).toBe(200)
      expect(result).toMatchObject({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
        profile: { id: 'user-123' },
        sessionId: expect.any(String)
      })
      expect(refreshScope.isDone()).toBe(true)
    })

    test('Should redirect to /login when refreshing the expired session token fails', async () => {
      const expiredToken = generateEntraJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })
      const cookie = await loginWithToken(server, expiredToken, 'old-refresh-token')

      nock('https://login.microsoftonline.com')
        .post(`/${ENTRA_TEST_FIXTURE_VALUE}/oauth2/v2.0/token`)
        .reply(400, { error: 'invalid_grant' })

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie }
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/login')
    })

    test('Should redirect to /login without calling the token endpoint when the session has no refresh token', async () => {
      const expiredToken = generateEntraJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })
      const cookie = await loginWithToken(server, expiredToken)

      const refreshScope = nock('https://login.microsoftonline.com')
        .post(`/${ENTRA_TEST_FIXTURE_VALUE}/oauth2/v2.0/token`)
        .reply(200, { access_token: 'new-access-token', refresh_token: 'new-refresh-token' })

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie }
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/login')
      expect(refreshScope.isDone()).toBe(false)
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        { type: 'entra_token_expired', error: expect.any(Error) },
        'Session token invalid and cannot be refreshed'
      )
    })

    test('Should not attempt to refresh a session token that has not expired', async () => {
      const token = generateEntraJwt()
      const cookie = await loginWithToken(server, token, 'old-refresh-token')

      const refreshScope = nock('https://login.microsoftonline.com')
        .post(`/${ENTRA_TEST_FIXTURE_VALUE}/oauth2/v2.0/token`)
        .reply(200, { access_token: 'new-access-token', refresh_token: 'new-refresh-token' })

      const { statusCode, result } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie }
      })

      expect(statusCode).toBe(200)
      expect(result.token).toBe(token)
      expect(refreshScope.isDone()).toBe(false)
    })
  })

  // ENTRA_USE_REFRESH_TOKENS is an Entra-only concern, but nothing stops it
  // being left set while AUTH_PROVIDER is 'local'. Local sessions carry no
  // refresh token (and no tenant/client to spend it against), so the refresh
  // path must not run for them.
  describe('when AUTH_PROVIDER is "local" and ENTRA_USE_REFRESH_TOKENS is true', () => {
    let server

    beforeEach(async () => {
      process.env.AUTH_PROVIDER = 'local'
      process.env.ENTRA_USE_REFRESH_TOKENS = 'true'
      delete process.env.ENTRA_TENANT_ID
      delete process.env.ENTRA_CLIENT_ID
      delete process.env.ENTRA_CLIENT_SECRET
      vi.resetModules()

      nock.disableNetConnect()

      server = await buildServerWithSession()
    })

    afterEach(async () => {
      await server.stop({ timeout: 0 })
      nock.cleanAll()
      nock.enableNetConnect()
    })

    test('Should redirect to /login without any outbound request when the session token has expired', async () => {
      const expiredToken = generateEntraJwt({ exp: Math.floor(Date.now() / 1000) - 3600 })
      const cookie = await loginWithToken(server, expiredToken)

      const requests = []

      nock.emitter.on('no match', (request) => requests.push(request))

      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie }
      })

      expect(statusCode).toBe(302)
      expect(headers.location).toBe('/login')
      expect(requests).toHaveLength(0)

      nock.emitter.removeAllListeners('no match')
    })
  })
})
