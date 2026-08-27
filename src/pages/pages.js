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
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .sort((a, b) => a.localeCompare(b))
}

const pageRouter = {
  plugin: {
    name: 'pageRouter',
    async register (server) {
      const routeFiles = await findRoutes(pagesDir)

      for (const routeFile of routeFiles) {
        const route = await import(routeFile)

        if (route.routes) {
          server.route(route.routes)
        }
      }
    }
  }
}

export {
  pageRouter
}
