import path from 'node:path'

import { registerRoutes } from '../../../src/pages/pages.js'

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
