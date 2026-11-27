import path from 'node:path'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { ROLES } from '../constants/roles.js'
import { requireRoles } from '../server/access-control/require-roles.js'

const pagesDir = path.dirname(path.join(fileURLToPath(import.meta.url)))

async function findRoutes (dir) {
  const entries = await readdir(dir, {
    withFileTypes: true,
    recursive: true
  })

  return entries
    .filter(entry => entry.isFile() && entry.name === 'routes.js')
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort((a, b) => a.localeCompare(b))
}

async function loadRouteModules (routeFiles) {
  return Promise.all(routeFiles.map((routeFile) => import(routeFile)))
}

// Every page and form under a prefix needs its role, including any added
// later. The administrator's area is its own page as well as what is under it.
const ROLE_PATHS = [
  {
    role: ROLES.EDITOR,
    matches: (path) => path.startsWith('/create-guidance/')
  },
  {
    role: ROLES.ADMIN,
    matches: (path) => path === '/admin' || path.startsWith('/admin/')
  }
]

function withRequiredRoles (route) {
  const rolePath = ROLE_PATHS.find((entry) => entry.matches(route.path))

  if (!rolePath) {
    return route
  }

  return {
    ...route,
    options: { ...route.options, auth: requireRoles(rolePath.role) }
  }
}

function registerRoutes (server, routeModules) {
  for (const routeModule of routeModules) {
    if (routeModule.routes) {
      server.route(routeModule.routes.map(withRequiredRoles))
    }
  }
}

const pageRouter = {
  plugin: {
    name: 'pageRouter',
    async register (server) {
      const routeFiles = await findRoutes(pagesDir)
      const routeModules = await loadRouteModules(routeFiles)

      registerRoutes(server, routeModules)
    }
  }
}

export {
  pageRouter,
  findRoutes,
  registerRoutes
}
