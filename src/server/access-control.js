import { config } from '../config/config.js'
import { ROLES } from '../constants/roles.js'
import { statusCodes } from '../constants/status-codes.js'

// The Hub.Viewer rule itself is hapi's route scope: the default auth in
// `plugins/auth/auth.js` requires it, and routes opt out with
// `auth.access.scope: false`. This module only decides where a refused user
// is sent.

const ACCESS_DENIED_PATH = '/access-denied'

/**
 * @param {import('./plugins/auth/auth.js').SessionCredentials} credentials
 * @returns {boolean} whether the user holds the Hub.Viewer role
 */
function hasViewerRole (credentials) {
  return credentials.roles.includes(ROLES.VIEWER)
}

/**
 * Whether the user may use the hub: always when `auth.requireViewerRole` is
 * off, otherwise only with Hub.Viewer.
 *
 * @param {import('./plugins/auth/auth.js').SessionCredentials} credentials
 * @returns {boolean}
 */
function canUseHub (credentials) {
  if (!config.get('auth.requireViewerRole')) {
    return true
  }

  return hasViewerRole(credentials)
}

/**
 * Whether a response is hapi refusing a signed-in user for lacking Hub.Viewer,
 * so they should be sent to the access-denied page. Any method qualifies: hapi
 * refuses before the handler runs, and the browser follows the redirect with
 * a GET, so a refused form post has changed nothing and is not re-sent.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {boolean}
 */
function isRefusedForViewerRole (request) {
  if (request.response.output.statusCode !== statusCodes.HTTP_STATUS_FORBIDDEN) {
    return false
  }

  if (!request.auth.isAuthenticated) {
    return false
  }

  return !canUseHub(request.auth.credentials)
}

export { ACCESS_DENIED_PATH, canUseHub, hasViewerRole, isRefusedForViewerRole }
