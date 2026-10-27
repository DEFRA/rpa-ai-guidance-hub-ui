import { createHash } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import nock from 'nock'

import { generateEntraJwt, getJwks, ENTRA_TEST_KID } from '../../../../utils/oidc.js'

const ENTRA_HOST = 'https://login.microsoftonline.com'
const TENANT_PATH = '/fake-tenant-id'
const NONCE = 'expected-nonce'

async function getOidc () {
  return import('../../../../../src/server/plugins/auth/oidc.js')
}

function mockJwks (jwks = getJwks(), status = 200) {
  return nock(ENTRA_HOST)
    .get(`${TENANT_PATH}/discovery/v2.0/keys`)
    .reply(status, jwks)
}

describe('#entraOidc', () => {
  beforeEach(() => {
    vi.resetModules()
    nock.disableNetConnect()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    nock.cleanAll()
    nock.enableNetConnect()
  })

  describe('#buildAuthorizationRequest', () => {
    test('sends the S256 challenge of the returned code verifier', async () => {
      const { buildAuthorizationRequest } = await getOidc()

      const { url, codeVerifier } = buildAuthorizationRequest()
      const challenge = new URL(url).searchParams.get('code_challenge')

      expect(challenge).toBe(createHash('sha256').update(codeVerifier).digest('base64url'))
    })

    test('returns the state and nonce it sent', async () => {
      const { buildAuthorizationRequest } = await getOidc()

      const { url, state, nonce } = buildAuthorizationRequest()
      const params = new URL(url).searchParams

      expect(params.get('state')).toBe(state)
      expect(params.get('nonce')).toBe(nonce)
    })
  })

  describe('#refreshTokens', () => {
    test('posts a refresh token grant authenticated with the client secret', async () => {
      const { refreshTokens } = await getOidc()

      const scope = nock(ENTRA_HOST)
        .post(`${TENANT_PATH}/oauth2/v2.0/token`, (body) => {
          const params = new URLSearchParams(body)

          return params.get('client_id') === 'fake-client-id' &&
            params.get('client_secret') === 'fake-client-secret' &&
            params.get('grant_type') === 'refresh_token' &&
            params.get('refresh_token') === 'old-refresh'
        })
        .reply(200, { access_token: 'new-access' })

      await expect(refreshTokens('old-refresh')).resolves.toEqual({ access_token: 'new-access' })
      expect(scope.isDone()).toBe(true)
    })

    test('includes Entra\'s error in the thrown message', async () => {
      const { refreshTokens } = await getOidc()

      nock(ENTRA_HOST)
        .post(`${TENANT_PATH}/oauth2/v2.0/token`)
        .reply(401, { error: 'invalid_client', error_description: 'AADSTS700213: No matching federated identity record' })

      await expect(refreshTokens('old-refresh')).rejects.toThrow(
        'Entra token request failed: 401 Unauthorized - invalid_client: AADSTS700213: No matching federated identity record'
      )
    })

    test('exposes Entra\'s error code on the thrown error', async () => {
      const { refreshTokens } = await getOidc()

      nock(ENTRA_HOST)
        .post(`${TENANT_PATH}/oauth2/v2.0/token`)
        .reply(400, { error: 'invalid_grant', error_description: 'AADSTS70000: expired' })

      await expect(refreshTokens('old-refresh')).rejects.toMatchObject({ code: 'invalid_grant' })
    })

    test('throws on a non-JSON error response', async () => {
      const { refreshTokens } = await getOidc()

      nock(ENTRA_HOST)
        .post(`${TENANT_PATH}/oauth2/v2.0/token`)
        .reply(502, 'Bad Gateway')

      await expect(refreshTokens('old-refresh')).rejects.toThrow('Entra token request failed: 502')
    })
  })

  describe('#verifyIdToken', () => {
    test('resolves with the payload of a validly-signed token with matching kid, aud, iss and nonce', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks()

      await expect(verifyIdToken(generateEntraJwt({ nonce: NONCE }), { nonce: NONCE })).resolves.toMatchObject({
        aud: 'fake-client-id',
        iss: `${ENTRA_HOST}${TENANT_PATH}/v2.0`,
        sub: 'user-id'
      })
    })

    test('rejects when the nonce does not match', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks()

      await expect(verifyIdToken(generateEntraJwt({ nonce: 'other' }), { nonce: NONCE })).rejects.toThrow()
    })

    test('rejects when the token has no nonce', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks()

      await expect(verifyIdToken(generateEntraJwt(), { nonce: NONCE })).rejects.toThrow()
    })

    test('rejects when the signature does not match the resolved public key', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks({ keys: [{ kty: 'RSA', kid: ENTRA_TEST_KID, use: 'sig', n: 'xGOr-H7A-PWLt', e: 'AQAB' }] })

      await expect(verifyIdToken(generateEntraJwt({ nonce: NONCE }), { nonce: NONCE })).rejects.toThrow()
    })

    test('rejects when the audience does not match the configured client ID', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks()

      await expect(
        verifyIdToken(generateEntraJwt({ nonce: NONCE, aud: 'wrong-client-id' }), { nonce: NONCE })
      ).rejects.toThrow()
    })

    test('rejects when the issuer does not match the configured authority/tenant', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks()

      await expect(
        verifyIdToken(generateEntraJwt({ nonce: NONCE, iss: `${ENTRA_HOST}/wrong-tenant/v2.0` }), { nonce: NONCE })
      ).rejects.toThrow()
    })

    test('rejects an expired token', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks()

      await expect(
        verifyIdToken(generateEntraJwt({ nonce: NONCE, exp: Math.floor(Date.now() / 1000) - 3600 }), { nonce: NONCE })
      ).rejects.toThrow()
    })

    test('rejects when the JWKS has no key matching the token kid', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks(getJwks({ kid: 'different-kid' }))

      await expect(verifyIdToken(generateEntraJwt({ nonce: NONCE }), { nonce: NONCE })).rejects.toThrow()
    })

    test('rejects when the JWKS endpoint returns an error', async () => {
      const { verifyIdToken } = await getOidc()

      mockJwks({ error: 'Internal Server Error' }, 500)

      await expect(verifyIdToken(generateEntraJwt({ nonce: NONCE }), { nonce: NONCE })).rejects.toThrow()
    })

    test('rejects a malformed token', async () => {
      const { verifyIdToken } = await getOidc()

      await expect(verifyIdToken('malformed.jwt', { nonce: NONCE })).rejects.toThrow()
    })

    test('caches JWKS keys across verifications', async () => {
      const { verifyIdToken } = await getOidc()

      nock(ENTRA_HOST)
        .get(`${TENANT_PATH}/discovery/v2.0/keys`)
        .once()
        .reply(200, getJwks())

      await verifyIdToken(generateEntraJwt({ nonce: NONCE }), { nonce: NONCE })

      await expect(
        verifyIdToken(generateEntraJwt({ nonce: NONCE, sub: 'user-2' }), { nonce: NONCE })
      ).resolves.toMatchObject({ sub: 'user-2' })
    })

    test('uses a custom ENTRA_AUTHORITY_HOST for keys and issuer', async () => {
      const customAuthority = 'https://custom.login.example.com'
      vi.stubEnv('ENTRA_AUTHORITY_HOST', customAuthority)

      const { verifyIdToken } = await getOidc()

      nock(customAuthority)
        .get(`${TENANT_PATH}/discovery/v2.0/keys`)
        .reply(200, getJwks())

      await expect(
        verifyIdToken(
          generateEntraJwt({ nonce: NONCE, iss: `${customAuthority}${TENANT_PATH}/v2.0` }),
          { nonce: NONCE }
        )
      ).resolves.toBeDefined()
    })
  })

  describe('#profileFromClaims', () => {
    test('maps oid, name and preferred_username to the session profile', async () => {
      const { profileFromClaims } = await getOidc()

      expect(profileFromClaims({ oid: 'oid-1', name: 'Test User', preferred_username: 'test@example.com' }))
        .toEqual({ id: 'oid-1', displayName: 'Test User', email: 'test@example.com' })
    })

    test('falls back to the email claim', async () => {
      const { profileFromClaims } = await getOidc()

      expect(profileFromClaims({ oid: 'oid-1', name: 'Test User', email: 'test@example.com' }).email)
        .toBe('test@example.com')
    })

    test('throws without an oid claim', async () => {
      const { profileFromClaims } = await getOidc()

      expect(() => profileFromClaims({ sub: 'sub-1' })).toThrow('Entra id_token has no oid claim')
    })
  })
})
