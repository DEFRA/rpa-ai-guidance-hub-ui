import nock from 'nock'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import * as sts from '../../../../fixtures/sts.js'

vi.mock('../../../../../src/infra/logging/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

const ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

async function getClientAuthParams () {
  const module = await import('../../../../../src/server/plugins/auth/client-auth.js')

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
    test('returns an STS web identity token for the Entra audience as the client assertion', async () => {
      vi.stubEnv('ENTRA_CLIENT_AUTH', 'federated')
      vi.stubEnv('ENTRA_FEDERATED_AUDIENCE', 'entra-audience')
      sts.interceptGetWebIdentityToken({
        audience: 'entra-audience',
        body: sts.getWebIdentityTokenResponse({ token: 'sts-jwt-a' })
      })

      const getParams = await getClientAuthParams()

      await expect(getParams()).resolves.toEqual({
        client_assertion_type: ASSERTION_TYPE,
        client_assertion: 'sts-jwt-a'
      })
    })
  })
})
