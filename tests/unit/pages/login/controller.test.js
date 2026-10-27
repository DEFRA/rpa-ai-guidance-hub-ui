import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import Hapi from '@hapi/hapi'
import HapiCookie from '@hapi/cookie'
import nock from 'nock'

import { ENTRA_TEST_KID, generateEntraJwt, getJwks } from '../../../utils/oidc.js'

const { mockLoggerWarn, mockLoggerError } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn()
}))

vi.mock('../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError
  })
}))

const ENTRA_HOST = 'https://login.microsoftonline.com'
const TENANT_PATH = '/fake-tenant-id'

const USER_OID = '00000000-0000-0000-0000-000000000123'

/**
 * Boots a Hapi server with the real auth plugin and login routes, plus a
 * protected route echoing the session credentials, so the Entra flow can be
 * driven end-to-end with `server.inject` and nock standing in for Entra.
 */
async function buildServer () {
  const { auth } = await import('../../../../src/server/plugins/auth/auth.js')
  const { routes } = await import('../../../../src/pages/login/routes.js')

  const server = Hapi.server()

  server.app.cache = server.cache({ segment: 'auth-session', expiresIn: 60_000 })

  await server.register(HapiCookie)
  await server.register(auth)

  server.route(routes)
  server.route({
    method: 'GET',
    path: '/protected',
    handler: (request) => request.auth.credentials
  })

  await server.initialize()

  return server
}

function cookieHeader (response) {
  return (response.headers['set-cookie'] ?? [])
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

/**
 * GET /login and return the OIDC parameters it sent to Entra, plus the
 * state cookie to replay on the callback.
 */
async function startLogin (server) {
  const response = await server.inject({ method: 'GET', url: '/login' })
  const location = new URL(response.headers.location)

  return {
    response,
    location,
    state: location.searchParams.get('state'),
    nonce: location.searchParams.get('nonce'),
    cookie: cookieHeader(response)
  }
}

function postCallback (server, { cookie, params }) {
  return server.inject({
    method: 'POST',
    url: '/login/callback',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie ? { cookie } : {})
    },
    payload: new URLSearchParams(params).toString()
  })
}

function getCallback (server, { cookie, params }) {
  return server.inject({
    method: 'GET',
    url: `/login/callback?${new URLSearchParams(params)}`,
    headers: cookie ? { cookie } : {}
  })
}

function mockTokenEndpoint (tokens, status = 200) {
  return nock(ENTRA_HOST)
    .post(`${TENANT_PATH}/oauth2/v2.0/token`)
    .reply(status, tokens)
}

function mockJwks () {
  return nock(ENTRA_HOST)
    .get(`${TENANT_PATH}/discovery/v2.0/keys`)
    .reply(200, getJwks())
}

function expectFailureLogged (type, level = 'error') {
  const [logged, other] = level === 'warn'
    ? [mockLoggerWarn, mockLoggerError]
    : [mockLoggerError, mockLoggerWarn]

  expect(other).not.toHaveBeenCalled()
  expect(logged).toHaveBeenCalledWith(
    expect.objectContaining({
      event: expect.objectContaining({ type, outcome: 'failure' })
    }),
    expect.stringContaining('Entra callback failed:')
  )
}

describe('#loginController', () => {
  let server

  beforeEach(async () => {
    vi.stubEnv('AUTH_PROVIDER', 'entra')
    vi.resetModules()
    nock.disableNetConnect()

    server = await buildServer()
  })

  afterEach(async () => {
    await server.stop({ timeout: 0 })
    nock.cleanAll()
    nock.enableNetConnect()
    vi.unstubAllEnvs()
  })

  describe('#startEntraLogin', () => {
    test('redirects to the Entra authorize endpoint with PKCE, state, nonce and query response mode', async () => {
      const { response, location } = await startLogin(server)

      expect(response.statusCode).toBe(302)
      expect(`${location.origin}${location.pathname}`).toBe(`${ENTRA_HOST}${TENANT_PATH}/oauth2/v2.0/authorize`)
      expect(Object.fromEntries(location.searchParams)).toEqual({
        client_id: 'fake-client-id',
        response_type: 'code',
        response_mode: 'query',
        redirect_uri: 'http://localhost:3000/login/callback',
        scope: 'User.Read openid profile email offline_access',
        state: expect.any(String),
        nonce: expect.any(String),
        code_challenge: expect.any(String),
        code_challenge_method: 'S256'
      })
    })

    test('sets an encrypted OIDC state cookie scoped to the callback', async () => {
      const { response, state } = await startLogin(server)
      const [stateCookie] = response.headers['set-cookie']

      expect(stateCookie).toMatch(/^entra-oidc=Fe26\.2\*\*/)
      expect(stateCookie).not.toContain(state)
      expect(stateCookie).toContain('Path=/login/callback')
      expect(stateCookie).toContain('HttpOnly')
    })

    test('generates fresh values for every sign-in', async () => {
      const first = await startLogin(server)
      const second = await startLogin(server)

      expect(second.state).not.toBe(first.state)
      expect(second.nonce).not.toBe(first.nonce)
    })
  })

  describe.each([
    ['POST', postCallback],
    ['GET', getCallback]
  ])('#handleEntraCallback via %s', (_method, sendCallback) => {
    test('exchanges the code, starts a session from the id_token claims and redirects to the hub', async () => {
      const { state, nonce, cookie } = await startLogin(server)
      const accessToken = generateEntraJwt()

      const tokenScope = nock(ENTRA_HOST)
        .post(`${TENANT_PATH}/oauth2/v2.0/token`, (body) => {
          const params = new URLSearchParams(body)

          return params.get('grant_type') === 'authorization_code' &&
              params.get('code') === 'auth-code' &&
              params.get('code_verifier')?.length > 0 &&
              params.get('redirect_uri') === 'http://localhost:3000/login/callback' &&
              params.get('client_secret') === 'fake-client-secret'
        })
        .reply(200, {
          access_token: accessToken,
          refresh_token: 'refresh-token',
          id_token: generateEntraJwt({ nonce, oid: USER_OID })
        })
      mockJwks()

      const callback = await sendCallback(server, { cookie, params: { code: 'auth-code', state } })

      expect(tokenScope.isDone()).toBe(true)
      expect(callback.statusCode).toBe(302)
      expect(callback.headers.location).toBe('/hub')

      const { result } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie: cookieHeader(callback) }
      })

      expect(result).toMatchObject({
        token: accessToken,
        refreshToken: 'refresh-token',
        profile: {
          id: USER_OID,
          displayName: 'Test User',
          email: 'testuser@example.com'
        }
      })
    })

    test('clears the OIDC state cookie so it cannot be replayed', async () => {
      const { state, nonce, cookie } = await startLogin(server)

      mockTokenEndpoint({
        access_token: generateEntraJwt(),
        id_token: generateEntraJwt({ nonce, oid: USER_OID })
      })
      mockJwks()

      const callback = await sendCallback(server, { cookie, params: { code: 'auth-code', state } })

      expect(callback.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringMatching(/^entra-oidc=; Max-Age=0/)])
      )
    })

    test('rejects a callback whose state does not match the cookie', async () => {
      const { cookie } = await startLogin(server)
      const tokenScope = mockTokenEndpoint({})

      const callback = await sendCallback(server, { cookie, params: { code: 'auth-code', state: 'forged' } })

      expect(callback.statusCode).toBe(401)
      expect(tokenScope.isDone()).toBe(false)
      expectFailureLogged('entra_state_mismatch', 'warn')
    })

    test('rejects a callback without the OIDC state cookie', async () => {
      const { state } = await startLogin(server)

      const callback = await sendCallback(server, { params: { code: 'auth-code', state } })

      expect(callback.statusCode).toBe(401)
      expectFailureLogged('entra_state_mismatch', 'warn')
    })

    test('rejects a callback without a code', async () => {
      const { state, cookie } = await startLogin(server)

      const callback = await sendCallback(server, { cookie, params: { state } })

      expect(callback.statusCode).toBe(401)
      expectFailureLogged('entra_state_mismatch', 'warn')
    })

    test('rejects and logs an error returned by Entra', async () => {
      const { state, cookie } = await startLogin(server)

      const callback = await sendCallback(server, {
        cookie,
        params: { error: 'access_denied', error_description: 'User cancelled', state }
      })

      expect(callback.statusCode).toBe(401)
      expectFailureLogged('entra_callback_error', 'warn')
    })

    test('rejects when the code exchange fails', async () => {
      const { state, cookie } = await startLogin(server)

      mockTokenEndpoint({ error: 'invalid_grant', error_description: 'AADSTS70008' }, 400)

      const callback = await sendCallback(server, { cookie, params: { code: 'auth-code', state } })

      expect(callback.statusCode).toBe(401)
      expect(callback.result.message).toBe('Authentication failed. Please try again.')
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({ type: 'entra_token_exchange_failed' }),
          error: expect.objectContaining({ message: expect.stringContaining('invalid_grant: AADSTS70008') })
        }),
        expect.stringContaining('invalid_grant: AADSTS70008')
      )
    })

    test('rejects an id_token issued for a different sign-in (nonce mismatch)', async () => {
      const { state, cookie } = await startLogin(server)

      mockTokenEndpoint({
        access_token: generateEntraJwt(),
        id_token: generateEntraJwt({ nonce: 'other-nonce', oid: USER_OID })
      })
      mockJwks()

      const callback = await sendCallback(server, { cookie, params: { code: 'auth-code', state } })

      expect(callback.statusCode).toBe(401)
      expectFailureLogged('entra_token_verification_failed')
    })

    test('rejects an id_token without an oid claim', async () => {
      const { state, nonce, cookie } = await startLogin(server)

      mockTokenEndpoint({
        access_token: generateEntraJwt(),
        id_token: generateEntraJwt({ nonce })
      })
      mockJwks()

      const callback = await sendCallback(server, { cookie, params: { code: 'auth-code', state } })

      expect(callback.statusCode).toBe(401)
      expectFailureLogged('entra_token_verification_failed')
    })

    test('rejects an id_token with a forged signature and starts no session', async () => {
      const { state, nonce, cookie } = await startLogin(server)

      mockTokenEndpoint({
        access_token: generateEntraJwt(),
        id_token: generateEntraJwt({ nonce, oid: USER_OID })
      })
      // Entra's published key is not the one that signed the token
      nock(ENTRA_HOST)
        .get(`${TENANT_PATH}/discovery/v2.0/keys`)
        .reply(200, { keys: [{ kty: 'RSA', kid: ENTRA_TEST_KID, use: 'sig', n: 'xGOr-H7A-PWLt', e: 'AQAB' }] })

      const response = await sendCallback(server, { cookie, params: { code: 'auth-code', state } })

      expect(response.statusCode).toBe(401)
      expect(response.headers['set-cookie']).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^sid/)])
      )
      expectFailureLogged('entra_token_verification_failed')

      // Still unauthenticated: the cookie strategy redirects to the sign-in page
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { cookie: cookieHeader(response) }
      })

      expect(statusCode).toBe(302)
    })
  })
})
