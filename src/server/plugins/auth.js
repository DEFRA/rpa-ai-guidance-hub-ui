import Bell from '@hapi/bell'
import Jwt from '@hapi/jwt'
import JwksRsa from 'jwks-rsa'

import { config } from '../../config/config.js'
import { createLogger } from '../../infra/logging/logger.js'

const logger = createLogger()

const entraConfig = {
  tenantId: config.get('auth.entra.tenantId'),
  clientId: config.get('auth.entra.clientId'),
  clientSecret: config.get('auth.entra.clientSecret'),
  authorityHost: config.get('auth.entra.authorityHost'),
  redirectHost: config.get('auth.entra.redirectHost'),
  scopes: ['User.Read', 'openid', 'profile', 'email']
}

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      server.auth.strategy('session', 'cookie', _getCookieOptions())
      server.auth.default('session')

      if (config.get('auth.provider') === 'entra') {
        logger.info('Using Microsoft Entra ID for authentication')

        await server.register(Bell)

        const jwksClient = _getJwksClient()

        server.auth.strategy('entra', 'bell', _getBellOptions())
        server.decorate('server', 'verifyEntraToken', (token) => _verifyEntraToken(token, jwksClient))
      } else {
        logger.info('Using dev authentication strategy (no external identity provider)')
      }
    }
  }
}

/**
 * @private
 * Creates a @type {Bell.BellOptions} object used to configure the 'azure'
 * authentication strategy using @package {@link https://hapi.dev/module/bell/ Bell}.
 *
 * This uses Microsoft Entra ID (formerly Azure AD) as the identity provider which
 * provides main auth strategy for the application.
 *
 * Bell's built-in 'azure' provider only surfaces the OAuth access_token, which
 * is scoped for Microsoft Graph (aud = Graph, not this app) and isn't something
 * we can or should verify ourselves. We wrap its `profile` hook to also stash
 * the OIDC id_token - whose aud is this app's clientId - onto credentials so
 * it can be verified against Entra's JWKS in `_verifyEntraToken`.
 *
 * @returns {Bell.BellOptions}
 */
function _getBellOptions () {
  const provider = Bell.providers.azure({
    tenant: entraConfig.tenantId
  })

  return {
    provider: {
      ...provider,
      profile: async function (credentials, params, get) {
        credentials.idToken = params.id_token

        await provider.profile.call(this, credentials, params, get)
      }
    },
    clientId: entraConfig.clientId,
    clientSecret: entraConfig.clientSecret,
    location: entraConfig.redirectHost,
    password: config.get('session.cookie.password'),
    isSecure: config.get('session.cookie.secure'),
    scope: entraConfig.scopes
  }
}

/**
 * @private
 * Builds the OpenID discovery/JWKS URI for the configured Entra tenant.
 *
 * @returns {string}
 */
function _getJwksUri () {
  const authorityHost = config.get('auth.entra.authorityHost')

  return `${authorityHost}/${entraConfig.tenantId}/discovery/v2.0/keys`
}

/**
 * @private
 * Creates a jwks-rsa client for the configured Entra tenant. The client
 * caches and rate-limits signing key lookups internally, so token
 * verification doesn't hit the discovery endpoint on every sign-in.
 *
 * @returns {JwksRsa.JwksClient}
 */
function _getJwksClient () {
  return JwksRsa({
    jwksUri: _getJwksUri(),
    cache: true,
    rateLimit: true
  })
}

/**
 * @private
 * Verifies a JWT issued by Entra ID against the tenant's published JWKS,
 * checking the signature, issuer, audience and expiry.
 *
 * This is the one place trust in an Entra-issued token is established -
 * everywhere else (e.g. `_validateSessionToken`) treats an already-stored
 * session token as trusted and only re-checks its expiry.
 *
 * @param {string} token
 * @param {JwksRsa.JwksClient} jwksClient
 * @returns {Promise<object>} the verified token payload
 */
async function _verifyEntraToken (token, jwksClient) {
  const artifacts = Jwt.token.decode(token)
  const { kid } = artifacts.decoded.header

  const signingKey = await jwksClient.getSigningKey(kid)
  const publicKey = signingKey.getPublicKey()

  Jwt.token.verifySignature(artifacts, publicKey)
  Jwt.token.verifyPayload(artifacts, {
    aud: entraConfig.clientId,
    iss: `${entraConfig.authorityHost}/${entraConfig.tenantId}/v2.0`
  })

  return artifacts.decoded.payload
}

async function _refreshEntraToken (refreshToken) {
  const tokenEndpoint = `${entraConfig.authorityHost}/${entraConfig.tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams()

  params.append('client_id', entraConfig.clientId)
  params.append('client_secret', entraConfig.clientSecret)
  params.append('grant_type', 'refresh_token')
  params.append('scope', entraConfig.scopes.join(' '))
  params.append('refresh_token', refreshToken)

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    body: params,
    signal: AbortSignal.timeout(config.get('auth.entra.refreshTokenAquisitionTimeout'))
  })

  if (!response.ok) {
    throw new Error(`Failed to refresh Entra token: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * @private
 * Creates a options object used to configure the 'session' authentication
 * strategy via @package {@link https://hapi.dev/module/cookie/ cookie}.
 *
 * This is used to maintain user sessions once authenticated via the
 * 'entra' strategy without triggering a complete OIDC authentication flow for
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
    redirectTo: '/login',
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
    if (!config.get('auth.entra.useRefreshTokens')) {
      // Prefer the server-scoped logger when validating a session so tests
      // (and runtime code) that decorate `server.logger` observe the
      // warning. Fall back to the module logger if the server logger is
      // not available.
      const warn = request?.server?.logger?.warn ?? logger.warn

      warn(
        { type: 'entra_token_expired', error },
        'Entra ID token invalid and refresh is disabled'
      )

      return { isValid: false }
    }

    const {
      access_token: token,
      refresh_token: refreshToken
    } = await _refreshEntraToken(userSession.refreshToken)

    userSession.token = token
    userSession.refreshToken = refreshToken

    await request.server.app.cache.set(`auth-session:${session.sessionId}`, userSession)
  }

  return { isValid: true, credentials: { ...userSession, sessionId: session.sessionId } }
}

export { auth }
