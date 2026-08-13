import crypto from 'crypto'

import Jwt from '@hapi/jwt'

const ENTRA_TEST_KID = 'test-kid-1'

let memoizedKeyPair = null

/**
 * Gets or generates a memoized RSA keypair for test JWTs.
 * Generated once per process, not per call (RSA keygen is slow).
 */
function getKeyPair () {
  if (!memoizedKeyPair) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048
    })
    memoizedKeyPair = { privateKey, publicKey }
  }
  return memoizedKeyPair
}

/**
 * Generates a real RS256-signed JWT token matching Entra ID claim structure.
 * Defaults match the ENTRA_* env vars set in vitest.setup.js.
 *
 * @param {object} claimOverrides - claim payload overrides (e.g. { aud: 'wrong-client-id' }, { exp: past timestamp })
 * @param {object} headerOverrides - JWT header overrides (e.g. { kid: 'different-kid' })
 * @returns {string} a signed RS256 JWT
 */
function generateEntraJwt (claimOverrides = {}, headerOverrides = {}) {
  const { privateKey } = getKeyPair()

  const now = Math.floor(Date.now() / 1000)
  const expiresIn = 3600

  const defaultPayload = {
    aud: process.env.ENTRA_CLIENT_ID || 'fake-client-id',
    iss: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID || 'fake-tenant-id'}/v2.0`,
    iat: now,
    exp: now + expiresIn,
    sub: 'user-id',
    name: 'Test User',
    preferred_username: 'testuser@example.com'
  }

  const payload = { ...defaultPayload, ...claimOverrides }

  const defaultHeader = { kid: ENTRA_TEST_KID }
  const header = { ...defaultHeader, ...headerOverrides }

  return Jwt.token.generate(payload, { key: privateKey, algorithm: 'RS256' }, {
    header,
    ttlSec: expiresIn,
    iat: false // payload already has iat; don't auto-add it
  })
}

/**
 * Returns a JWKS document (standard discovery-endpoint JSON shape)
 * containing the public key from the test keypair.
 *
 * @param {object} options - options for JWKS generation
 * @param {string} options.kid - key ID to use in the JWKS (defaults to ENTRA_TEST_KID)
 * @param {boolean} options.includeMatchingKey - if false, omit the matching key from the JWKS (defaults to true)
 * @returns {object} a { keys: [...] } JWKS document
 */
function getJwks ({ kid = ENTRA_TEST_KID, includeMatchingKey = true } = {}) {
  if (!includeMatchingKey) {
    return { keys: [] }
  }

  const { publicKey } = getKeyPair()
  const publicKeyJwk = publicKey.export({ format: 'jwk' })

  return {
    keys: [
      {
        ...publicKeyJwk,
        kid,
        use: 'sig'
      }
    ]
  }
}

export {
  ENTRA_TEST_KID,
  generateEntraJwt,
  getJwks
}
