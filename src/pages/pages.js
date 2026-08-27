import path from 'node:path'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

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

function registerRoutes (server, routeModules) {
  for (const routeModule of routeModules) {
    if (routeModule.routes) {
      server.route(routeModule.routes)
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
