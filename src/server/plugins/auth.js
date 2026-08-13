import Bell from '@hapi/bell'
import Jwt from '@hapi/jwt'
import JwksRsa from 'jwks-rsa'

import { config } from '../../config/config.js'

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
    tenant: config.get('auth.entra.tenantId')
  })

  return {
    provider: {
      ...provider,
      profile: async function (credentials, params, get) {
        credentials.idToken = params.id_token

        await provider.profile.call(this, credentials, params, get)
      }
    },
    clientId: config.get('auth.entra.clientId'),
    clientSecret: config.get('auth.entra.clientSecret'),
    location: config.get('auth.entra.redirectHost'),
    password: config.get('session.cookie.password'),
    isSecure: config.get('session.cookie.secure'),
    scope: ['User.Read', 'openid', 'profile', 'email']
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
  const tenantId = config.get('auth.entra.tenantId')

  return `${authorityHost}/${tenantId}/discovery/v2.0/keys`
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
    aud: config.get('auth.entra.clientId'),
    iss: `${config.get('auth.entra.authorityHost')}/${config.get('auth.entra.tenantId')}/v2.0`
  })

  return artifacts.decoded.payload
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
  const userSession = await request.yar.get('userAuth')

  if (!userSession) {
    return { isValid: false }
  }

  try {
    const decoded = Jwt.token.decode(userSession.token)

    Jwt.token.verifyTime(decoded)
  } catch (error) {
    request.server.logger.info('Session JWT token is invalid or has expired')

    return { isValid: false }
  }

  return { isValid: true, credentials: { ...userSession, sessionId: request.yar.id } }
}

const auth = {
  plugin: {
    name: 'auth',
    register: async (server) => {
      server.auth.strategy('session', 'cookie', _getCookieOptions())
      server.auth.default('session')

      if (config.get('auth.provider') === 'entra') {
        await server.register(Bell)

        const jwksClient = _getJwksClient()

        server.auth.strategy('entra', 'bell', _getBellOptions())
        server.decorate('server', 'verifyEntraToken', (token) => _verifyEntraToken(token, jwksClient))
      }
    }
  }
}

export { auth }
