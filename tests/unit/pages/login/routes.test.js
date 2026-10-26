import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

async function getRoutes () {
  const { routes } = await import('../../../../src/pages/login/routes.js')

  return routes
}

async function getController () {
  return import('../../../../src/pages/login/controller.js')
}

function findRoute (routes, method, path) {
  return routes.find((route) => route.method === method && route.path === path)
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

    test('signs in as the dev user from an unauthenticated /login route', async () => {
      const routes = await getRoutes()
      const controller = await getController()
      const loginRoute = findRoute(routes, 'GET', '/login')

      expect(loginRoute.options.auth).toBe(false)
      expect(loginRoute.handler).toBe(controller.loginAsDevUser)
    })

    test('does not register the Entra callback route', async () => {
      const routes = await getRoutes()

      expect(routes.some((route) => route.path === '/login/callback')).toBe(false)
    })
  })

  describe('when AUTH_PROVIDER is "entra"', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_PROVIDER', 'entra')
      vi.resetModules()
    })

    test('starts the Entra flow from an unauthenticated /login route', async () => {
      const routes = await getRoutes()
      const controller = await getController()
      const loginRoute = findRoute(routes, 'GET', '/login')

      expect(loginRoute.options.auth).toBe(false)
      expect(loginRoute.handler).toBe(controller.startEntraLogin)
    })

    test('accepts the form_post callback on an unauthenticated POST /login/callback route', async () => {
      const routes = await getRoutes()
      const controller = await getController()
      const callbackRoute = findRoute(routes, 'POST', '/login/callback')

      expect(callbackRoute.options.auth).toBe(false)
      expect(callbackRoute.handler).toBe(controller.handleEntraCallback)
    })
  })
})
