import { createHash, randomBytes } from 'node:crypto'

import Jwt from '@hapi/jwt'
import JwksRsa from 'jwks-rsa'

import { config } from '../../../config/config.js'
import { getClientAuthParams } from './client-credentials.js'

const SCOPES = ['User.Read', 'openid', 'profile', 'email', 'offline_access']

const CALLBACK_PATH = '/login/callback'

const entraClientId = config.get('auth.entra.clientId')

let jwksClient = null

/**
 * Builds the Entra authorization request for the OIDC authorization code
 * flow with PKCE. The returned `state`, `nonce` and `codeVerifier` must be
 * held (in the OIDC state cookie) until the callback, to be checked against
 * the response and passed to `exchangeCode`/`verifyIdToken`.
 *
 * `response_mode=form_post` has Entra return the code in a POST body rather
 * than the callback URL, keeping it out of browser history and access logs.
 *
 * @returns {{ url: string, state: string, nonce: string, codeVerifier: string }}
 */
function buildAuthorizationRequest () {
  const state = _randomValue()
  const nonce = _randomValue()
  const codeVerifier = _randomValue()

  const url = new URL(`${_tenantUrl()}/oauth2/v2.0/authorize`)

  url.search = new URLSearchParams({
    client_id: entraClientId,
    response_type: 'code',
    response_mode: 'form_post',
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(' '),
    state,
    nonce,
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    code_challenge_method: 'S256'
  }).toString()

  return { url: url.toString(), state, nonce, codeVerifier }
}

/**
 * The redirect URI registered on the Entra app registration.
 *
 * @returns {string}
 */
function getRedirectUri () {
  return `${config.get('auth.entra.redirectHost')}${CALLBACK_PATH}`
}

/**
 * Exchanges an authorization code for tokens.
 *
 * @param {object} params
 * @param {string} params.code
 * @param {string} params.codeVerifier - the PKCE verifier from `buildAuthorizationRequest`
 * @returns {Promise<object>} Entra's token response (`access_token`, `id_token`, `refresh_token`, ...)
 */
async function exchangeCode ({ code, codeVerifier }) {
  return _requestTokens({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    redirect_uri: getRedirectUri()
  })
}

/**
 * Exchanges a refresh token for a new set of tokens.
 *
 * @param {string} refreshToken
 * @returns {Promise<object>} Entra's token response
 */
async function refreshTokens (refreshToken) {
  return _requestTokens({
    grant_type: 'refresh_token',
    scope: SCOPES.join(' '),
    refresh_token: refreshToken
  })
}

/**
 * Verifies an id_token issued by Entra ID against the tenant's published
 * JWKS, checking the signature, issuer, audience, expiry and nonce.
 *
 * This is the one place trust in an Entra-issued token is established -
 * everywhere else (e.g. `_validateSessionToken` in the auth plugin) treats
 * an already-stored session token as trusted and only re-checks its expiry.
 *
 * @param {string} idToken
 * @param {object} params
 * @param {string} params.nonce - the nonce sent in the authorization request
 * @returns {Promise<object>} the verified token payload
 */
async function verifyIdToken (idToken, { nonce }) {
  const artifacts = Jwt.token.decode(idToken)
  const { kid } = artifacts.decoded.header

  jwksClient ??= JwksRsa({
    jwksUri: `${_tenantUrl()}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true
  })

  const signingKey = await jwksClient.getSigningKey(kid)

  Jwt.token.verifySignature(artifacts, signingKey.getPublicKey())
  Jwt.token.verifyPayload(artifacts, {
    aud: entraClientId,
    iss: `${_tenantUrl()}/v2.0`
  })

  if (!nonce || artifacts.decoded.payload.nonce !== nonce) {
    throw new Error('Entra id_token nonce mismatch')
  }

  return artifacts.decoded.payload
}

/**
 * Maps verified id_token claims to the session profile shape the rest of the
 * app reads (`id`, `displayName`, `email`). `oid` is the user's object ID -
 * the same value Microsoft Graph returns as `/me` `id`.
 *
 * @param {object} claims
 * @returns {{ id: string, displayName: string, email: string }}
 */
function profileFromClaims (claims) {
  if (!claims.oid) {
    throw new Error('Entra id_token has no oid claim')
  }

  return {
    id: claims.oid,
    displayName: claims.name,
    email: claims.preferred_username ?? claims.email
  }
}

/**
 * @private
 * POSTs a token request, authenticated with the configured client
 * credentials (secret or federated assertion).
 *
 * @param {Record<string, string>} params - grant-specific parameters
 * @returns {Promise<object>}
 */
async function _requestTokens (params) {
  const body = new URLSearchParams({
    client_id: entraClientId,
    ...params,
    ...(await getClientAuthParams())
  })

  const response = await fetch(`${_tenantUrl()}/oauth2/v2.0/token`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(config.get('auth.entra.refreshTokenAcquisitionTimeout'))
  })

  if (!response.ok) {
    // Entra's `error`/`error_description` (e.g. an AADSTS code) is what
    // distinguishes a bad grant from a misconfigured client credential.
    const { error, error_description: description } = await response.json().catch(() => ({}))

    throw new Error(
      `Entra token request failed: ${response.status} ${response.statusText}` +
      (error ? ` - ${error}: ${description}` : '')
    )
  }

  return response.json()
}

/**
 * @private
 * @returns {string}
 */
function _tenantUrl () {
  return `${config.get('auth.entra.authorityHost')}/${config.get('auth.entra.tenantId')}`
}

/**
 * @private
 *
 * @returns {string} a URL-safe random value suitable for state, nonce or a
 *   PKCE code verifier
 */
function _randomValue () {
  return randomBytes(32).toString('base64url')
}

export {
  buildAuthorizationRequest,
  exchangeCode,
  getRedirectUri,
  profileFromClaims,
  refreshTokens,
  verifyIdToken
}
