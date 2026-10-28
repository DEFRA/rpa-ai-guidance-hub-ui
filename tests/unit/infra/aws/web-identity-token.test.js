import Https from 'node:https'

import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import * as sts from '../../../fixtures/sts.js'

import { WebIdentityTokenProvider } from '../../../../src/infra/aws/web-identity-token.js'

const AUDIENCE = 'test-audience'

vi.mock('../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

function createProvider (overrides = {}) {
  return new WebIdentityTokenProvider({
    durationSeconds: 300,
    earlyRefreshMs: 60000,
    ...overrides
  })
}

describe('WebIdentityTokenProvider', () => {
  beforeAll(() => {
    nock.disableNetConnect()
  })

  afterAll(() => {
    nock.enableNetConnect()
  })

  beforeEach(() => {
    vi.stubEnv('AWS_REGION', sts.STS_REGION)
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'test-access-key')
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'test-secret-key')
  })

  afterEach(() => {
    nock.cleanAll()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  test('returns the token issued by STS', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' }) })

    const provider = createProvider()

    await expect(provider.getToken(AUDIENCE)).resolves.toBe('sts-jwt-a')
  })

  test('sends a GetWebIdentityToken request for an RS256 token with the given audience', async () => {
    const { captured } = sts.interceptGetWebIdentityToken()

    const provider = createProvider()
    await provider.getToken(AUDIENCE)

    expect(captured.body).toMatchObject({
      Action: 'GetWebIdentityToken',
      'Audience.member.1': AUDIENCE,
      SigningAlgorithm: 'RS256',
      DurationSeconds: '300'
    })
  })

  test('requests the duration it was created with', async () => {
    const { captured } = sts.interceptGetWebIdentityToken()

    const provider = createProvider({ durationSeconds: 900 })
    await provider.getToken(AUDIENCE)

    expect(captured.body).toMatchObject({
      DurationSeconds: '900'
    })
  })

  test('routes STS requests through the global https agent so the egress proxy applies', async () => {
    sts.interceptGetWebIdentityToken()
    const requestSpy = vi.spyOn(Https, 'request')

    const provider = createProvider()
    await provider.getToken(AUDIENCE)

    const stsCall = requestSpy.mock.calls.find(([options]) => options?.host === `sts.${sts.STS_REGION}.amazonaws.com`)

    expect(stsCall[0].agent).toBe(Https.globalAgent)
  })

  test('reuses the cached token while it is outside the early-refresh window', async () => {
    const { scope } = sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ expiresInSec: 300 }) })

    const provider = createProvider()
    await provider.getToken(AUDIENCE)
    const second = await provider.getToken(AUDIENCE)

    // Only one interceptor is registered and net connect is disabled, so a
    // second STS call would have rejected.
    expect(second).toBe('sts-jwt-a')
    expect(scope.isDone()).toBe(true)
  })

  test('reuses a nearly expired token when created with no early-refresh window', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a', expiresInSec: 30 }) })

    const provider = createProvider({ earlyRefreshMs: 0 })
    await provider.getToken(AUDIENCE)
    const second = await provider.getToken(AUDIENCE)

    // Only one interceptor is registered and net connect is disabled, so a
    // refresh would have rejected.
    expect(second).toBe('sts-jwt-a')
  })

  describe('when the cached token is within the early-refresh window', () => {
    let provider

    beforeEach(async () => {
      sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a', expiresInSec: 30 }) })

      provider = createProvider()
      await provider.getToken(AUDIENCE)
    })

    test('fetches a new token', async () => {
      sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-b', expiresInSec: 300 }) })

      await expect(provider.getToken(AUDIENCE)).resolves.toBe('sts-jwt-b')
    })

    test('throws when the refresh fails, rather than returning the unexpired cached token', async () => {
      sts.interceptGetWebIdentityToken({ body: sts.stsErrorResponse({ message: 'not allowed' }), status: 403 })

      await expect(provider.getToken(AUDIENCE)).rejects.toThrow('not allowed')
    })
  })

  test('falls back to the requested duration when STS omits the expiration', async () => {
    const { scope } = sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ expiresInSec: null }) })

    const provider = createProvider()
    await provider.getToken(AUDIENCE)
    const second = await provider.getToken(AUDIENCE)

    expect(second).toBe('sts-jwt-a')
    expect(scope.isDone()).toBe(true)
  })

  test('caches a separate token for each audience', async () => {
    const first = sts.interceptGetWebIdentityToken({
      audience: 'audience-a',
      body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' })
    })
    const second = sts.interceptGetWebIdentityToken({
      audience: 'audience-b',
      body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-b' })
    })

    const provider = createProvider()

    await expect(provider.getToken('audience-a')).resolves.toBe('sts-jwt-a')
    await expect(provider.getToken('audience-b')).resolves.toBe('sts-jwt-b')
    await expect(provider.getToken('audience-a')).resolves.toBe('sts-jwt-a')
    expect(first.scope.isDone()).toBe(true)
    expect(second.scope.isDone()).toBe(true)
  })

  test('shares a single in-flight request between concurrent callers', async () => {
    const { scope } = sts.interceptGetWebIdentityToken()

    const provider = createProvider()
    const [first, second] = await Promise.all([provider.getToken(AUDIENCE), provider.getToken(AUDIENCE)])

    expect(first).toBe(second)
    expect(scope.isDone()).toBe(true)
  })

  test('rejects every concurrent caller with the STS error when the shared request fails', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.stsErrorResponse({ message: 'not allowed' }), status: 403 })

    const provider = createProvider()
    const results = await Promise.allSettled([provider.getToken(AUDIENCE), provider.getToken(AUDIENCE)])

    // A second STS request would hit no interceptor and fail with nock's
    // disallowed-net-connect error instead.
    expect(results.map(({ reason }) => reason?.message)).toEqual(['not allowed', 'not allowed'])
  })

  test('throws when STS fails, and retries on the next call', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.stsErrorResponse({ message: 'not allowed' }), status: 403 })
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' }) })

    const provider = createProvider()

    await expect(provider.getToken(AUDIENCE)).rejects.toThrow('not allowed')
    await expect(provider.getToken(AUDIENCE)).resolves.toBe('sts-jwt-a')
  })

  test('throws when STS returns no token', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: '' }) })

    const provider = createProvider()

    await expect(provider.getToken(AUDIENCE)).rejects.toThrow(`STS returned no web identity token for audience ${AUDIENCE}`)
  })
})
