import Jwt from '@hapi/jwt'

import { config } from '../../../config/config.js'
import { refreshTokens } from './oidc.js'
import { createLogger } from '../../../infra/logging/logger.js'

const logger = createLogger()

const OIDC_STATE_COOKIE = 'entra-oidc'

const tenMinutesMs = 10 * 60 * 1000

const REJECTED_REFRESH_ERRORS = new Set(['invalid_grant', 'interaction_required'])

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
 * @returns {import('@hapi/hapi').ServerStateCookieOptions}
 */
function _getOidcStateCookieOptions () {
  return {
    encoding: 'iron',
    password: config.get('session.cookie.password'),
    path: '/login/callback',
    ttl: tenMinutesMs,
    isHttpOnly: true,
    isSecure: true,
    isSameSite: 'None',
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
      isSameSite: 'Lax',
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

    const tokens = await _tryRefreshTokens(userSession.refreshToken)

    if (!tokens) {
      return { isValid: false }
    }

    userSession.token = tokens.access_token
    userSession.refreshToken = tokens.refresh_token ?? userSession.refreshToken

    await request.server.app.cache.set(`auth-session:${session.sessionId}`, userSession)
  }

  return { isValid: true, credentials: { ...userSession, sessionId: session.sessionId } }
}

/**
 * @private
 * Arranges for the refresh token to be used to obtain a new access token, and
 * returns the new token response. If the refresh fails due to a user-caused
 * error (e.g. the refresh token has been revoked), it returns `null` instead of
 * throwing.
 *
 * If the refresh fails due to a non-user-caused error (e.g. network failure), it throws the error.
 *
 * @param {string} refreshToken
 * @returns {Promise<object|null>} Entra's token response
 */
async function _tryRefreshTokens (refreshToken) {
  try {
    return await refreshTokens(refreshToken)
  } catch (error) {
    if (!REJECTED_REFRESH_ERRORS.has(error.code)) {
      logger.error({ type: 'entra_refresh_failed', error }, 'Token refresh failed')

      throw error
    }

    logger.warn({ type: 'entra_refresh_rejected', error }, 'Refresh token rejected')

    return null
  }
}

export { auth, OIDC_STATE_COOKIE }
