import Jwt from '@hapi/jwt'

import { config } from '../../../config/config.js'
import { refreshTokens } from './oidc.js'
import { createLogger } from '../../../infra/logging/logger.js'

const logger = createLogger()

const OIDC_STATE_COOKIE = 'entra-oidc'

const tenMinutesMs = 10 * 60 * 1000

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      server.auth.strategy('session', 'cookie', _getCookieOptions())
      server.auth.default('session')

      if (config.get('auth.provider') === 'entra') {
        logger.info(
          { clientAuth: config.get('auth.entra.clientAuth') },
          'Using Microsoft Entra ID for authentication'
        )

        server.state(OIDC_STATE_COOKIE, _getOidcStateCookieOptions())
      } else {
        logger.info('Using dev authentication strategy (no external identity provider)')
      }
    }
  }
}

/**
 * @private
 * Options for the short-lived cookie holding the OIDC `state`, `nonce` and
 * PKCE verifier between `/login` and `/login/callback`.
 *
 * Entra returns to the callback with a cross-site form POST
 * (`response_mode=form_post`), so the cookie must be `SameSite=None` to be
 * sent with it - which browsers only accept on a `Secure` cookie. Over plain
 * HTTP it falls back to `Lax`.
 *
 * @returns {import('@hapi/hapi').ServerStateCookieOptions}
 */
function _getOidcStateCookieOptions () {
  const isSecure = config.get('session.cookie.secure')

  return {
    encoding: 'iron',
    password: config.get('session.cookie.password'),
    path: '/login/callback',
    ttl: tenMinutesMs,
    isHttpOnly: true,
    isSecure,
    isSameSite: isSecure ? 'None' : 'Lax',
    clearInvalid: true,
    ignoreErrors: true
  }
}

/**
 * @private
 * Creates a options object used to configure the 'session' authentication
 * strategy via @package {@link https://hapi.dev/module/cookie/ cookie}.
 *
 * This is used to maintain user sessions once authenticated via the Entra
 * OIDC flow (see `pages/login`) without triggering a complete sign-in for
 * each request.
 *
 * @returns {object} CookieAuthOptions
 */
function _getCookieOptions () {
  return {
    cookie: {
      password: config.get('session.cookie.password'),
      path: '/',
      isSecure: config.get('session.cookie.secure'),
      ttl: config.get('session.cookie.ttl')
    },
    redirectTo: '/',
    validate: _validateSessionToken
  }
}

/**
 * @private
 * Validates the authentication token issued by the identity provider
 * that is stored in the user session is still valid.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {object} session
 * @returns {Promise<{isValid: boolean, credentials?: object}>}
 */
async function _validateSessionToken (request, session) {
  const userSession = await request.server.app.cache.get(`auth-session:${session.sessionId}`)

  if (!userSession) {
    return { isValid: false }
  }

  try {
    const decoded = Jwt.token.decode(userSession.token)

    Jwt.token.verifyTime(decoded)
  } catch (error) {
    if (!config.get('auth.entra.useRefreshTokens') || !userSession.refreshToken) {
      logger.warn(
        { type: 'entra_token_expired', error },
        'Session token invalid and cannot be refreshed'
      )

      return { isValid: false }
    }

    const {
      access_token: token,
      refresh_token: refreshToken
    } = await refreshTokens(userSession.refreshToken)

    userSession.token = token
    userSession.refreshToken = refreshToken

    await request.server.app.cache.set(`auth-session:${session.sessionId}`, userSession)
  }

  return { isValid: true, credentials: { ...userSession, sessionId: session.sessionId } }
}

export { auth, OIDC_STATE_COOKIE }
