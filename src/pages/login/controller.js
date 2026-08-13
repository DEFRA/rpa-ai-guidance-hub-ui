import Jwt from '@hapi/jwt'

import { config } from '../../config/config.js'
import { createLogger } from '../../infra/logging/logger.js'
import { buildErrorLog } from '../../infra/logging/utils/build-error-log.js'

const logger = createLogger()

/**
 * GET /login — renders the sign-in page.
 * @param {Hapi.Request} request
 * @param {Hapi.ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function getLogin (request, h) {
  if (request.auth.isAuthenticated) {
    return h.redirect('/')
  }

  return h.view('login/login.njk', {
    pageTitle: 'Sign in'
  })
}

/**
 * GET /login/callback (Redirect URI) — shared by both auth providers.
 *
 * For the 'entra' provider this is a genuine OIDC redirect URI: Bell
 * provides request.auth.isAuthenticated and request.auth.credentials, and
 * the id_token is verified against Entra's JWKS. For the 'local' provider
 * this route has no strategy attached at all (see `login/router.js`) - it
 * shadows the same URL and just writes a fixed mock session, with no OAuth
 * round-trip.
 *
 * @param {Hapi.Request} request
 * @param {Hapi.ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function handleLoginCallback (request, h) {
  const { profile, token } = config.get('auth.provider') === 'entra'
    ? await _getEntraSession(request)
    : _getDevSession()

  request.yar.set('userAuth', {
    token,
    profile
  })

  request.cookieAuth.set({ sessionId: request.yar.id })

  return h.redirect('/')
}

/**
 * GET /logout — clears the session and redirects.
 * @param {Hapi.Request} request
 * @param {Hapi.ResponseToolkit} h
 * @returns {Promise<any>}
 */
async function logout (request, h) {
  request.yar.reset()
  request.cookieAuth.clear()

  return h.redirect('/')
}

/**
 * @private
 * Validates the Bell-authenticated Entra callback and verifies its
 * id_token against Entra's JWKS.
 *
 * @param {Hapi.Request} request
 * @returns {Promise<{ profile: object, token: string }>}
 */
async function _getEntraSession (request) {
  if (!request.auth.isAuthenticated) {
    throw new Error('Authentication failed')
  }

  const { profile, token, idToken } = request.auth.credentials

  try {
    await request.server.verifyEntraToken(idToken)
  } catch (error) {
    logger.warn(buildErrorLog(error, { type: 'entra_token_verification_failed' }), 'Entra token failed JWKS verification')

    throw new Error('Authentication failed')
  }

  return { profile, token }
}

/**
 * @private
 * Builds a mock user session for local development, standing in for a
 * completed Entra ID sign-in without performing any OAuth round-trip.
 *
 * The token must still be a well-formed JWT (with a future `exp`) because
 * `_validateSessionToken` in `auth.js` decodes and time-checks whatever
 * token is stored in the session on every subsequent request, regardless
 * of provider - it just isn't signature-verified for local auth.
 *
 * @returns {{ token: string, profile: object }}
 */
function _getDevSession () {
  const token = Jwt.token.generate(
    { sub: 'dev-user-123' },
    { key: 'dev-auth-mock-key', algorithm: 'HS256' },
    { ttlSec: config.get('session.cookie.ttl') / 1000 }
  )

  return {
    token,
    profile: {
      id: 'dev-user-123',
      email: 'dev@example.com',
      displayName: 'Dev User',
      name: { familyName: 'User', givenName: 'Dev' },
      emails: [{ value: 'dev@example.com' }],
      mail: 'dev@example.com',
      mailNickname: 'dev',
      givenName: 'Dev',
      surname: 'User',
      userPrincipalName: 'dev@example.com'
    }
  }
}

export {
  getLogin,
  handleLoginCallback,
  logout
}
