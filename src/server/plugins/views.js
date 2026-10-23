import path from 'node:path'
import fs from 'node:fs'

import hapiVision from '@hapi/vision'
import nunjucks from 'nunjucks'

import { config } from '../../config/config.js'
import { jsonScript, renderMarkdownFallback } from '../../pages/guide/markdown.js'
import { isNavCollapsed } from '../../pages/side-nav/collapsed.js'

const nunjucksEnvironment = nunjucks.configure(
  [
    'node_modules/govuk-frontend/dist',
    path.join(config.get('root'), './src/pages')
  ],
  {
    autoescape: true,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true
  }
)

// Both filters return markup that is already safe, so mark it as such rather
// than have autoescape mangle it.
nunjucksEnvironment.addFilter('jsonScript', value => nunjucks.runtime.markSafe(jsonScript(value)))
nunjucksEnvironment.addFilter('markdownFallback', (markdown, headingIds) => nunjucks.runtime.markSafe(renderMarkdownFallback(markdown, headingIds)))

function loadManifest () {
  const manifestPath = path.join(
    config.get('root'),
    '.public/.vite/manifest.json'
  )

  if (!fs.existsSync(manifestPath)) {
    if (config.get('env') === 'production') {
      throw new Error(`Vite manifest file not found at ${manifestPath}`)
    }

    console.warn(`Vite manifest file not found at ${manifestPath}. Asset paths may not be resolved correctly.`)

    return {}
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
}

const assetPath = config.get('assetPath')
const serviceName = config.get('serviceName')

const viteManifest = loadManifest()

const viewPlugin = {
  plugin: hapiVision,
  options: {
    engines: {
      njk: {
        compile (src, options) {
          const template = nunjucks.compile(src, options.environment)

          return (context) => template.render(context)
        }
      }
    },
    compileOptions: {
      environment: nunjucksEnvironment
    },
    relativeTo: config.get('root'),
    path: 'src/pages',
    isCached: config.get('env') === 'production',
    context: (request) => ({
      assetPath: `${assetPath}/assets`,
      getAssetPath (asset) {
        const manifestEntry = viteManifest?.[asset]

        const viteAsset = typeof manifestEntry === 'object'
          ? manifestEntry?.file
          : manifestEntry

        return `${assetPath}/${viteAsset ?? asset}`
      },
      serviceName,
      currentPath: request?.path,
      // Blankie generates nonces when configured with generateNonces: true
      // Returns { script, style } when enabled, undefined otherwise
      cspNonce: request?.plugins?.blankie?.nonces,
      isAuthenticated: Boolean(request?.auth?.isAuthenticated),
      // The hub has no roles yet, so everyone gets the designer's view; an
      // operator's view is the same without the designer's functions.
      isDesigner: true,
      // Read only when signed in, when the nav shows: a page no route matches
      // has no session to read.
      sideNavCollapsed: request?.auth?.isAuthenticated ? isNavCollapsed(request) : false,
      // Where a form on the page sends the user back to: this page.
      currentUrl: request?.url ? `${request.url.pathname}${request.url.search}` : null,
      userDisplayName: request?.auth?.credentials?.profile?.displayName ?? null
    })
  }
}

export { viewPlugin }
