import Https from 'node:https'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockSend, mockClientConstructor } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockClientConstructor: vi.fn()
}))

vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: class {
    constructor (options) {
      mockClientConstructor(options)
    }

    send (command) {
      return mockSend(command)
    }
  },
  GetWebIdentityTokenCommand: class {
    constructor (input) {
      this.input = input
    }
  }
}))

vi.mock('../../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

/**
 * Builds a GetWebIdentityToken response for an (opaque, test-only) token
 * expiring `expiresInSec` from now.
 */
function stsResponse (token, expiresInSec) {
  return {
    WebIdentityToken: token,
    Expiration: new Date(Date.now() + expiresInSec * 1000)
  }
}

async function getClientAuthParams () {
  const module = await import('../../../../../src/server/plugins/auth/client-credentials.js')

  return module.getClientAuthParams
}

describe('#getClientAuthParams', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('when ENTRA_CLIENT_AUTH is "secret"', () => {
    test('returns the configured client secret without calling STS', async () => {
      vi.stubEnv('ENTRA_CLIENT_AUTH', 'secret')

      const getParams = await getClientAuthParams()

      // ENTRA_CLIENT_SECRET is a test placeholder set in vitest.setup.js
      await expect(getParams()).resolves.toEqual({ client_secret: process.env.ENTRA_CLIENT_SECRET })
      expect(mockClientConstructor).not.toHaveBeenCalled()
    })
  })

  describe('when ENTRA_CLIENT_AUTH is "federated"', () => {
    beforeEach(() => {
      vi.stubEnv('ENTRA_CLIENT_AUTH', 'federated')
    })

    test('returns an STS web identity token as the client assertion', async () => {
      mockSend.mockResolvedValue(stsResponse('sts-jwt-a', 300))

      const getParams = await getClientAuthParams()

      await expect(getParams()).resolves.toEqual({
        client_assertion_type: ASSERTION_TYPE,
        client_assertion: 'sts-jwt-a'
      })
    })

    test('requests an RS256 token for the default Entra token exchange audience', async () => {
      mockSend.mockResolvedValue(stsResponse('sts-jwt-a', 300))

      const getParams = await getClientAuthParams()
      await getParams()

      expect(mockSend.mock.calls[0][0].input).toEqual({
        Audience: ['api://AzureADTokenExchange'],
        SigningAlgorithm: 'RS256',
        DurationSeconds: 300
      })
    })

    test('requests the configured audience and duration', async () => {
      vi.stubEnv('ENTRA_FEDERATED_AUDIENCE', 'api://custom-audience')
      vi.stubEnv('ENTRA_FEDERATED_DURATION_SECONDS', '900')
      mockSend.mockResolvedValue(stsResponse('sts-jwt-a', 900))

      const getParams = await getClientAuthParams()
      await getParams()

      expect(mockSend.mock.calls[0][0].input).toMatchObject({
        Audience: ['api://custom-audience'],
        DurationSeconds: 900
      })
    })

    test('routes STS requests through the global https agent so the egress proxy applies', async () => {
      mockSend.mockResolvedValue(stsResponse('sts-jwt-a', 300))

      const getParams = await getClientAuthParams()
      await getParams()

      expect(mockClientConstructor).toHaveBeenCalledWith({
        requestHandler: { httpsAgent: Https.globalAgent }
      })
    })

    test('reuses the cached token while it is outside the early-refresh window', async () => {
      mockSend.mockResolvedValue(stsResponse('sts-jwt-a', 300))

      const getParams = await getClientAuthParams()
      await getParams()
      const second = await getParams()

      expect(second.client_assertion).toBe('sts-jwt-a')
      expect(mockSend).toHaveBeenCalledOnce()
    })

    test('fetches a new token once the cached one is within the early-refresh window', async () => {
      mockSend
        .mockResolvedValueOnce(stsResponse('sts-jwt-a', 30))
        .mockResolvedValueOnce(stsResponse('sts-jwt-b', 300))

      const getParams = await getClientAuthParams()
      await getParams()
      const second = await getParams()

      expect(second.client_assertion).toBe('sts-jwt-b')
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    test('falls back to the requested duration when STS omits the expiration', async () => {
      mockSend.mockResolvedValue({ WebIdentityToken: 'sts-jwt-a' })

      const getParams = await getClientAuthParams()
      await getParams()
      await getParams()

      expect(mockSend).toHaveBeenCalledOnce()
    })

    test('shares a single in-flight request between concurrent callers', async () => {
      mockSend.mockResolvedValue(stsResponse('sts-jwt-a', 300))

      const getParams = await getClientAuthParams()
      const [first, second] = await Promise.all([getParams(), getParams()])

      expect(first.client_assertion).toBe(second.client_assertion)
      expect(mockSend).toHaveBeenCalledOnce()
    })

    test('throws when STS fails, and retries on the next call', async () => {
      mockSend
        .mockRejectedValueOnce(new Error('AccessDenied'))
        .mockResolvedValueOnce(stsResponse('sts-jwt-a', 300))

      const getParams = await getClientAuthParams()

      await expect(getParams()).rejects.toThrow('AccessDenied')
      await expect(getParams()).resolves.toHaveProperty('client_assertion', 'sts-jwt-a')
    })

    test('throws when STS returns no token', async () => {
      mockSend.mockResolvedValue({})

      const getParams = await getClientAuthParams()

      await expect(getParams()).rejects.toThrow('STS returned no web identity token for the federated client assertion')
    })
  })
})
