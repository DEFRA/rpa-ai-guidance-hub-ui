import path from 'node:path'
import fs from 'node:fs'

import hapiVision from '@hapi/vision'
import nunjucks from 'nunjucks'

import { config } from '../../config/config.js'
import { ROLES, roleDisplayNames } from '../../constants/roles.js'
import { roleEnforcementEnabled } from '../access-control/hub-access.js'
import { getConsent, isConsentSet } from '../cookie-consent.js'
import { bookmarkedToHtml, headingControlsHtml } from '../../constants/heading-bookmarks.js'
import { jsonScript, renderMarkdownFallback } from '../../pages/guide/markdown.js'
import { filtersFrom, listHref } from '../../pages/hub/filters.js'
import { isNavCollapsed } from '../../pages/side-nav/collapsed.js'
import { SIDE_NAV_WIDTH } from '../../pages/side-nav/width.js'

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
nunjucksEnvironment.addFilter('markdownFallback', (markdown, headingIds, headingBookmarks) => nunjucks.runtime.markSafe(renderMarkdownFallback(markdown, headingIds, headingBookmarks)))
nunjucksEnvironment.addFilter('headingControls', (controls, heading) => nunjucks.runtime.markSafe(headingControlsHtml(controls, heading)))
nunjucksEnvironment.addFilter('bookmarkedTo', bookmark => nunjucks.runtime.markSafe(bookmarkedToHtml(bookmark)))

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

function _formatRolesCaption (roles) {
  const names = roleDisplayNames(roles)

  if (names.length === 0) {
    return null
  }

  return names.join(', ')
}

// Signed-out pages render too, with no credentials; signed in, they are always
// the SessionCredentials built in plugins/auth/auth.js.
function _userRoles (request) {
  if (!request?.auth?.isAuthenticated) {
    return []
  }

  return request.auth.credentials.roles
}

function _userDisplayName (request) {
  if (!request?.auth?.isAuthenticated) {
    return null
  }

  return request.auth.credentials.profile.displayName
}

const assetPath = config.get('assetPath')
const serviceName = config.get('serviceName')
const accessRequestEmail = config.get('accessRequestEmail')
const gtmContainerId = config.get('googleTagManager.containerId')

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
    context: (request) => {
      const roles = _userRoles(request)

      return {
        assetPath: `${assetPath}/assets`,
        getAssetPath (asset) {
          const manifestEntry = viteManifest?.[asset]

          const viteAsset = typeof manifestEntry === 'object'
            ? manifestEntry?.file
            : manifestEntry

          return `${assetPath}/${viteAsset ?? asset}`
        },
        serviceName,
        accessRequestEmail,
        currentPath: request?.path,
        // Blankie generates nonces when configured with generateNonces: true
        // Returns { script, style } when enabled, undefined otherwise
        cspNonce: request?.plugins?.blankie?.nonces,
        isAuthenticated: Boolean(request?.auth?.isAuthenticated),
        // The editor's functions are not rendered at all for anyone else, unless
        // roles are not enforced, when everyone gets them.
        isEditor: !roleEnforcementEnabled() || roles.includes(ROLES.EDITOR),
        roles,
        userRolesCaption: _formatRolesCaption(roles),
        // Read only when signed in, when the nav shows: a page no route matches
        // has no session to read.
        sideNavCollapsed: request?.auth?.isAuthenticated ? isNavCollapsed(request) : false,
        // The open navigation's width, which its handle can change, and the
        // limits it changes within.
        sideNavWidth: SIDE_NAV_WIDTH.default,
        sideNavWidthLimits: SIDE_NAV_WIDTH,
        // The hub's filters chosen on this page, which the side navigation's
        // links to the hub and its lists carry on: '' or '?audience=…'.
        listQuery: listHref('', filtersFrom(request?.query)),
        // Where a form on the page sends the user back to: this page.
        currentUrl: request?.url ? `${request.url.pathname}${request.url.search}` : null,
        userDisplayName: _userDisplayName(request),
        // Google Tag Manager. Only set when a container ID is configured, so the
        // layout can decide whether to show the cookie banner at all.
        gtmContainerId,
        // Cookie consent, read from the cookies set by /cookies/accept and
        // /cookies/reject. The banner uses these to know whether to be shown or
        // hidden, and the client JS uses this to load analytics once accepted.
        cookieConsent: getConsent(request),
        cookieConsentSet: isConsentSet(request),
        // Set by the accept/reject redirect, e.g. 'accept' or 'reject'.
        cookieAction: request?.query?.cookieAction || null
      }
    }
  }
}

export { viewPlugin }
