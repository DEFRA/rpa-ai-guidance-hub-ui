import { randomUUID as uuidv4, timingSafeEqual } from 'node:crypto'

import Boom from '@hapi/boom'
import Jwt from '@hapi/jwt'

import * as oidc from '../../server/plugins/auth/oidc.js'
import { config } from '../../config/config.js'
import { createLogger } from '../../infra/logging/logger.js'
import { buildErrorLog } from '../../infra/logging/utils/build-error-log.js'
import { OIDC_STATE_COOKIE } from '../../server/plugins/auth/auth.js'
import { mockUser } from './mock-user.js'

const logger = createLogger()

const AUTH_FAIL_MESSAGE = 'Authentication failed. Please try again.'

/**
 * GET /login — 'entra' provider. Starts the OIDC authorization code flow:
 * holds the state, nonce and PKCE verifier in the (encrypted) OIDC state
 * cookie and redirects to Entra's authorize endpoint.
 *
 * @param {Hapi.Request} _request
 * @param {Hapi.ResponseToolkit} h
 * @returns {Hapi.ResponseObject}
 */
function startEntraLogin (_request, h) {
  const { url, state, nonce, codeVerifier } = oidc.buildAuthorizationRequest()

  return h
    .redirect(url)
    .state(OIDC_STATE_COOKIE, { state, nonce, codeVerifier })
}

/**
 * GET|POST /login/callback (Redirect URI) — 'entra' provider. Entra returns
 * the authorization response here, on the query string for `response_mode=query`
 * (what we request) or in a POST body for `form_post`. Checks it against
 * the OIDC state cookie, exchanges the code for tokens, verifies the
 * id_token and starts a session.
 *
 * Every failure is logged with its cause and surfaced to the user as the
 * same generic 401.
 *
 * @param {Hapi.Request} request
 * @param {Hapi.ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function handleEntraCallback (request, h) {
  const { code, state, error, error_description: errorDescription } = request.payload ?? request.query ?? {}
  const oidcState = request.state[OIDC_STATE_COOKIE]

  h.unstate(OIDC_STATE_COOKIE)

  if (error) {
    _failLogin(new Error(`${error}: ${errorDescription}`), 'entra_callback_error')
  }

  if (!code || !oidcState?.nonce || !_isSameValue(state, oidcState.state)) {
    _failLogin(
      new Error(oidcState ? 'State mismatch or missing code' : 'Missing OIDC state cookie'),
      'entra_state_mismatch'
    )
  }

  let tokens

  try {
    tokens = await oidc.exchangeCode({ code, codeVerifier: oidcState.codeVerifier })
  } catch (err) {
    _failLogin(err, 'entra_token_exchange_failed')
  }

  let profile

  try {
    const claims = await oidc.verifyIdToken(tokens.id_token, { nonce: oidcState.nonce })

    profile = oidc.profileFromClaims(claims)
  } catch (err) {
    _failLogin(err, 'entra_token_verification_failed')
  }

  return _startSession(request, h, {
    profile,
    token: tokens.access_token,
    refreshToken: tokens.refresh_token
  })
}

/**
 * GET /login — 'local' provider. Signs in as a fixed mock user for local
 * development, standing in for a completed Entra ID sign-in without
 * performing any OAuth round-trip.
 *
 * The token must still be a well-formed JWT (with a future `exp`) because
 * `_validateSessionToken` in `auth.js` decodes and time-checks whatever
 * token is stored in the session on every subsequent request, regardless
 * of provider - it just isn't signature-verified for local auth.
 *
 * @param {Hapi.Request} request
 * @param {Hapi.ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function loginAsDevUser (request, h) {
  const token = Jwt.token.generate(
    { sub: 'dev-user-123' },
    { key: 'dev-auth-mock-key', algorithm: 'HS256' },
    { ttlSec: config.get('session.cookie.ttl') / 1000 }
  )

  return _startSession(request, h, { profile: mockUser, token })
}

/**
 * GET /logout — clears the session and redirects.
 * @param {Hapi.Request} request
 * @param {Hapi.ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function logout (request, h) {
  if (request.auth.isAuthenticated) {
    const { sessionId } = request.auth.credentials

    await request.yar.reset()
    await request.server.app.cache.drop(`auth-session:${sessionId}`)
    request.cookieAuth.clear()
  }

  return h.redirect('/')
}

/**
 * @private
 * Stores the session server-side, sets the session cookie and redirects to
 * the hub.
 *
 * @param {Hapi.Request} request
 * @param {Hapi.ResponseToolkit} h
 * @param {{ profile: object, token: string, refreshToken?: string }} session
 * @returns {Promise<any>}
 */
async function _startSession (request, h, { profile, token, refreshToken }) {
  const sessionId = uuidv4()

  await request.server.app.cache.set(`auth-session:${sessionId}`, { profile, token, refreshToken })

  request.cookieAuth.set({ sessionId })

  return h.redirect('/hub')
}

/**
 * @private
 * @param {Error} error
 * @param {string} type
 * @throws {Boom.Boom} always - a generic 401 that hides the cause
 */
function _failLogin (error, type) {
  logger.warn(buildErrorLog(error, { type }))

  throw Boom.unauthorized(AUTH_FAIL_MESSAGE)
}

/**
 * @private
 * Constant-time comparison of the returned and expected `state`.
 *
 * @param {unknown} actual
 * @param {unknown} expected
 * @returns {boolean}
 */
function _isSameValue (actual, expected) {
  if (typeof actual !== 'string' || typeof expected !== 'string') {
    return false
  }

  const a = Buffer.from(actual)
  const b = Buffer.from(expected)

  return a.length === b.length && timingSafeEqual(a, b)
}

export {
  handleEntraCallback,
  loginAsDevUser,
  logout,
  startEntraLogin
}
