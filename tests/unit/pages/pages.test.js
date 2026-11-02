import path from 'node:path'

import { ROLES } from '../../../src/constants/roles.js'
import { registerRoutes } from '../../../src/pages/pages.js'
import { requireRoles } from '../../../src/server/access-control/require-roles.js'

describe('#registerRoutes', () => {
  test('registers routes for modules that export a routes array', () => {
    const server = { route: vi.fn() }
    const routes = [{ method: 'GET', path: '/example', handler: vi.fn() }]

    registerRoutes(server, [{ routes }])

    expect(server.route).toHaveBeenCalledWith(routes)
  })

  test('skips modules that do not export any routes', () => {
    const server = { route: vi.fn() }

    registerRoutes(server, [{}])

    expect(server.route).not.toHaveBeenCalled()
  })

  test('requires the editor role on every create-guidance route, keeping its other options', () => {
    const server = { route: vi.fn() }
    const validate = { payload: vi.fn() }
    const routes = [{
      method: 'POST',
      path: '/create-guidance/example',
      options: { app: { roleRequiredReason: 'do an example' }, validate },
      handler: vi.fn()
    }]

    registerRoutes(server, [{ routes }])

    const [registered] = server.route.mock.calls[0][0]
    expect(registered.options).toEqual({
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'do an example' },
      validate
    })
  })

  test('leaves routes outside create-guidance as they are', () => {
    const server = { route: vi.fn() }
    const route = { method: 'GET', path: '/hub/create-guidance', handler: vi.fn() }

    registerRoutes(server, [{ routes: [route] }])

    expect(server.route.mock.calls[0][0][0]).toBe(route)
  })
})

describe('#findRoutes', () => {
  test('finds and sorts nested routes.js files', async () => {
    const { findRoutes } = await import('../../../src/pages/pages.js')

    const routeFiles = await findRoutes(path.join(process.cwd(), 'src/pages'))

    expect(routeFiles.length).toBeGreaterThan(0)
    expect(routeFiles.every((file) => file.endsWith('routes.js'))).toBe(true)
    expect([...routeFiles].sort((a, b) => a.localeCompare(b))).toEqual(routeFiles)
  })
})
