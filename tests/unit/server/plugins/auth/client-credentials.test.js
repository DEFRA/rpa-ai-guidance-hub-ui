import Https from 'node:https'

import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import * as sts from '../../../../fixtures/sts.js'

vi.mock('../../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

async function getClientAuthParams () {
  const module = await import('../../../../../src/server/plugins/auth/client-credentials.js')

  return module.getClientAuthParams
}

describe('#getClientAuthParams', () => {
  beforeAll(() => {
    nock.disableNetConnect()
  })

  afterAll(() => {
    nock.enableNetConnect()
  })

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('AWS_REGION', sts.STS_REGION)
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-access-key')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret-key')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('when ENTRA_CLIENT_AUTH is "secret"', () => {
    test('returns the configured client secret without calling STS', async () => {
      vi.stubEnv('ENTRA_CLIENT_AUTH', 'secret')
      const { scope } = sts.interceptGetWebIdentityToken()

      const getParams = await getClientAuthParams()

      // ENTRA_CLIENT_SECRET is a test placeholder set in vitest.setup.js
      await expect(getParams()).resolves.toEqual({ client_secret: process.env.ENTRA_CLIENT_SECRET })
      expect(scope.isDone()).toBe(false)
    })
  })

  describe('when ENTRA_CLIENT_AUTH is "federated"', () => {
    beforeEach(() => {
      vi.stubEnv('ENTRA_CLIENT_AUTH', 'federated')
    })

    test('returns an STS web identity token as the client assertion', async () => {
      sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' }) })

      const getParams = await getClientAuthParams()

      await expect(getParams()).resolves.toEqual({
        client_assertion_type: ASSERTION_TYPE,
        client_assertion: 'sts-jwt-a'
      })
    })

    test('sends a GetWebIdentityToken request for an RS256 token with the default audience', async () => {
      const { captured } = sts.interceptGetWebIdentityToken()

      const getParams = await getClientAuthParams()
      await getParams()

      expect(captured.body).toMatchObject({
        Action: 'GetWebIdentityToken',
        'Audience.member.1': 'rpa_ai_guidance_hub_ui',
        SigningAlgorithm: 'RS256',
        DurationSeconds: '300'
      })
    })

    test('requests the configured audience and duration', async () => {
      vi.stubEnv('ENTRA_FEDERATED_AUDIENCE', 'api://custom-audience')
      vi.stubEnv('ENTRA_FEDERATED_DURATION_SECONDS', '900')
      const { captured } = sts.interceptGetWebIdentityToken({ audience: 'api://custom-audience' })

      const getParams = await getClientAuthParams()
      await getParams()

      expect(captured.body).toMatchObject({
        DurationSeconds: '900'
      })
    })

    test('routes STS requests through the global https agent so the egress proxy applies', async () => {
      sts.interceptGetWebIdentityToken()
      const requestSpy = vi.spyOn(Https, 'request')

      const getParams = await getClientAuthParams()
      await getParams()

      const stsCall = requestSpy.mock.calls.find(([options]) => options?.host === `sts.${sts.STS_REGION}.amazonaws.com`)

      expect(stsCall[0].agent).toBe(Https.globalAgent)
    })

    test('reuses the cached token while it is outside the early-refresh window', async () => {
      const { scope } = sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ expiresInSec: 300 }) })

      const getParams = await getClientAuthParams()
      await getParams()
      const second = await getParams()

      // Only one interceptor is registered and net connect is disabled, so a
      // second STS call would have rejected.
      expect(second.client_assertion).toBe('sts-jwt-a')
      expect(scope.isDone()).toBe(true)
    })

    test('fetches a new token once the cached one is within the early-refresh window', async () => {
      sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a', expiresInSec: 30 }) })
      sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-b', expiresInSec: 300 }) })

      const getParams = await getClientAuthParams()
      await getParams()
      const second = await getParams()

      expect(second.client_assertion).toBe('sts-jwt-b')
    })

    test('falls back to the requested duration when STS omits the expiration', async () => {
      const { scope } = sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ expiresInSec: null }) })

      const getParams = await getClientAuthParams()
      await getParams()
      const second = await getParams()

      expect(second.client_assertion).toBe('sts-jwt-a')
      expect(scope.isDone()).toBe(true)
    })

    test('shares a single in-flight request between concurrent callers', async () => {
      const { scope } = sts.interceptGetWebIdentityToken()

      const getParams = await getClientAuthParams()
      const [first, second] = await Promise.all([getParams(), getParams()])

      expect(first.client_assertion).toBe(second.client_assertion)
      expect(scope.isDone()).toBe(true)
    })

    test('throws when STS fails, and retries on the next call', async () => {
      sts.interceptGetWebIdentityToken({ body: sts.stsErrorResponse({ message: 'not allowed' }), status: 403 })
      sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' }) })

      const getParams = await getClientAuthParams()

      await expect(getParams()).rejects.toThrow('not allowed')
      await expect(getParams()).resolves.toHaveProperty('client_assertion', 'sts-jwt-a')
    })

    test('throws when STS returns no token', async () => {
      sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: '' }) })

      const getParams = await getClientAuthParams()

      await expect(getParams()).rejects.toThrow('STS returned no web identity token for the federated client assertion')
    })
  })
})
