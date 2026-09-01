import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

async function getRoutes () {
  const { routes } = await import('../../../../src/pages/login/routes.js')

  return routes
}

describe('#loginRoutes', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('when AUTH_PROVIDER is "local"', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'local')
      vi.resetModules()
    })

    test('disables auth on the login callback route', async () => {
      const routes = await getRoutes()
      const callbackRoute = routes.find((route) => route.path === '/login/callback')

      expect(callbackRoute.options.auth).toBe(false)
    })
  })

  describe('when AUTH_PROVIDER is "entra"', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'entra')
      vi.resetModules()
    })

    test('uses the entra bell strategy on the login callback route', async () => {
      const routes = await getRoutes()
      const callbackRoute = routes.find((route) => route.path === '/login/callback')

      expect(callbackRoute.options.auth).toEqual({ mode: 'try', strategy: 'entra' })
    })
  })
})
