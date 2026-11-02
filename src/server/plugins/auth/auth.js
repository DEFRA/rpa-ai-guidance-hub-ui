import Jwt from '@hapi/jwt'

import { config } from '../../../config/config.js'
import { ROLES } from '../../../constants/roles.js'
import { roleEnforcementEnabled } from '../../access-control/hub-access.js'
import { profileFromClaims, refreshTokens, GRANT_TYPES, verifyIdToken } from './oidc.js'
import { createLogger } from '../../../infra/logging/logger.js'

const logger = createLogger()

const OIDC_STATE_COOKIE = 'entra-oidc'

const tenMinutesMs = 10 * 60 * 1000

const REJECTED_REFRESH_ERRORS = new Set(['invalid_grant', 'interaction_required'])

/**
 * The `request.auth.credentials` of every signed-in request. Built only here,
 * so code reading it can rely on this shape without fallbacks.
 *
 * @typedef {object} SessionCredentials
 * @property {string} sessionId
 * @property {{ id: string, displayName: string, email: string, roles: string[] }} profile
 *   - as `profileFromClaims` (Entra) or the local mock user builds it
 * @property {string[]} roles - the user's app roles, as `profile.roles`, or
 *   none if the session predates roles. The one place anything that checks or
 *   shows a role reads them from.
 * @property {string[]} scope - the roles again, for hapi route `access.scope`
 * @property {string} token
 * @property {string} [refreshToken]
 */

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      server.auth.strategy('session', 'cookie', _getCookieOptions())
      server.auth.default(_getDefaultAuth())

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
 * Every route needs a session. With `auth.enforceRoles` on, it must also
 * hold Hub.Viewer (credentials carry the roles as `scope`), unless the route
 * sets `auth: false` or `auth.access.scope: false`. hapi checks scope only
 * once the session is valid, so a signed-out user is still sent to sign in
 * first.
 *
 * @returns {import('@hapi/hapi').RouteOptionsAccess & { strategy: string }}
 */
function _getDefaultAuth () {
  if (!roleEnforcementEnabled()) {
    return { strategy: 'session' }
  }

  return { strategy: 'session', access: { scope: [ROLES.VIEWER] } }
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
 * @returns {Promise<{isValid: boolean, credentials?: SessionCredentials}>}
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

    const profile = await _profileFromRefreshedTokens(tokens)

    if (!profile) {
      return { isValid: false }
    }

    userSession.profile = { ...userSession.profile, ...profile }
    userSession.token = tokens.access_token
    userSession.refreshToken = tokens.refresh_token ?? userSession.refreshToken

    await request.server.app.cache.set(`auth-session:${session.sessionId}`, userSession)
  }

  return {
    isValid: true,
    credentials: _toCredentials(userSession, session.sessionId)
  }
}

/**
 * @private
 * @param {{ profile: SessionCredentials['profile'], token: string, refreshToken?: string }} userSession
 * @param {string} sessionId
 * @returns {SessionCredentials}
 */
function _toCredentials (userSession, sessionId) {
  // A session stored before roles were added has none: it holds no roles.
  const roles = userSession.profile.roles ?? []

  return {
    ...userSession,
    sessionId,
    roles,
    scope: roles
  }
}

/**
 * @private
 * Re-derives the session profile (notably its roles) from the verified ID
 * token returned by a refresh, so revoked roles stop granting access. Returns
 * `null` (forcing a new sign-in) if there is no valid ID token to take them from.
 *
 * @param {object} tokens - Entra's token response
 * @returns {Promise<object|null>}
 */
async function _profileFromRefreshedTokens (tokens) {
  if (!tokens.id_token) {
    logger.warn({ type: 'entra_refresh_no_id_token' }, 'Refresh response has no id_token; cannot refresh roles')

    return null
  }

  try {
    const claims = await verifyIdToken(tokens.id_token, { grantType: GRANT_TYPES.REFRESH_TOKEN })

    return profileFromClaims(claims)
  } catch (error) {
    logger.warn({ type: 'entra_refresh_id_token_invalid', error }, 'Refreshed id_token could not be verified')

    return null
  }
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
