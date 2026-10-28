import Https from 'node:https'

import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import * as sts from '../../../fixtures/sts.js'

const AUDIENCE = 'test-audience'

vi.mock('../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

async function importGetWebIdentityToken () {
  const module = await import('../../../../src/infra/aws/web-identity-token.js')

  return module.getWebIdentityToken
}

describe('#getWebIdentityToken', () => {
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

  test('returns the token issued by STS', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' }) })

    const getWebIdentityToken = await importGetWebIdentityToken()

    await expect(getWebIdentityToken(AUDIENCE)).resolves.toBe('sts-jwt-a')
  })

  test('sends a GetWebIdentityToken request for an RS256 token with the given audience', async () => {
    const { captured } = sts.interceptGetWebIdentityToken()

    const getWebIdentityToken = await importGetWebIdentityToken()
    await getWebIdentityToken(AUDIENCE)

    expect(captured.body).toMatchObject({
      Action: 'GetWebIdentityToken',
      'Audience.member.1': AUDIENCE,
      SigningAlgorithm: 'RS256',
      DurationSeconds: '300'
    })
  })

  test('requests the configured duration', async () => {
    vi.stubEnv('WEB_IDENTITY_TOKEN_DURATION_SECONDS', '900')
    const { captured } = sts.interceptGetWebIdentityToken()

    const getWebIdentityToken = await importGetWebIdentityToken()
    await getWebIdentityToken(AUDIENCE)

    expect(captured.body).toMatchObject({
      DurationSeconds: '900'
    })
  })

  test('routes STS requests through the global https agent so the egress proxy applies', async () => {
    sts.interceptGetWebIdentityToken()
    const requestSpy = vi.spyOn(Https, 'request')

    const getWebIdentityToken = await importGetWebIdentityToken()
    await getWebIdentityToken(AUDIENCE)

    const stsCall = requestSpy.mock.calls.find(([options]) => options?.host === `sts.${sts.STS_REGION}.amazonaws.com`)

    expect(stsCall[0].agent).toBe(Https.globalAgent)
  })

  test('reuses the cached token while it is outside the early-refresh window', async () => {
    const { scope } = sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ expiresInSec: 300 }) })

    const getWebIdentityToken = await importGetWebIdentityToken()
    await getWebIdentityToken(AUDIENCE)
    const second = await getWebIdentityToken(AUDIENCE)

    // Only one interceptor is registered and net connect is disabled, so a
    // second STS call would have rejected.
    expect(second).toBe('sts-jwt-a')
    expect(scope.isDone()).toBe(true)
  })

  test('fetches a new token once the cached one is within the early-refresh window', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a', expiresInSec: 30 }) })
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-b', expiresInSec: 300 }) })

    const getWebIdentityToken = await importGetWebIdentityToken()
    await getWebIdentityToken(AUDIENCE)
    const second = await getWebIdentityToken(AUDIENCE)

    expect(second).toBe('sts-jwt-b')
  })

  test('falls back to the requested duration when STS omits the expiration', async () => {
    const { scope } = sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ expiresInSec: null }) })

    const getWebIdentityToken = await importGetWebIdentityToken()
    await getWebIdentityToken(AUDIENCE)
    const second = await getWebIdentityToken(AUDIENCE)

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

    const getWebIdentityToken = await importGetWebIdentityToken()

    await expect(getWebIdentityToken('audience-a')).resolves.toBe('sts-jwt-a')
    await expect(getWebIdentityToken('audience-b')).resolves.toBe('sts-jwt-b')
    await expect(getWebIdentityToken('audience-a')).resolves.toBe('sts-jwt-a')
    expect(first.scope.isDone()).toBe(true)
    expect(second.scope.isDone()).toBe(true)
  })

  test('shares a single in-flight request between concurrent callers', async () => {
    const { scope } = sts.interceptGetWebIdentityToken()

    const getWebIdentityToken = await importGetWebIdentityToken()
    const [first, second] = await Promise.all([getWebIdentityToken(AUDIENCE), getWebIdentityToken(AUDIENCE)])

    expect(first).toBe(second)
    expect(scope.isDone()).toBe(true)
  })

  test('throws when STS fails, and retries on the next call', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.stsErrorResponse({ message: 'not allowed' }), status: 403 })
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' }) })

    const getWebIdentityToken = await importGetWebIdentityToken()

    await expect(getWebIdentityToken(AUDIENCE)).rejects.toThrow('not allowed')
    await expect(getWebIdentityToken(AUDIENCE)).resolves.toBe('sts-jwt-a')
  })

  test('throws when STS returns no token', async () => {
    sts.interceptGetWebIdentityToken({ body: sts.getWebIdentityTokenResponse({ token: '' }) })

    const getWebIdentityToken = await importGetWebIdentityToken()

    await expect(getWebIdentityToken(AUDIENCE)).rejects.toThrow(`STS returned no web identity token for audience ${AUDIENCE}`)
  })
})
