import { ROLES } from '../../constants/roles.js'
import { roleEnforcementEnabled } from './hub-access.js'

/**
 * Route auth for pages and endpoints that need particular roles, GET and POST
 * alike: `options: { auth: requireRoles(ROLES.EDITOR) }`. The user must hold
 * every role listed (hapi's `+` scope prefix).
 *
 * A route's own `access.scope` replaces the default one, so the Viewer
 * requirement is restated while `auth.enforceRoles` is on.
 *
 * @param {...string} roles
 * @returns {{ strategy: string, access: { scope: string[] } }}
 */
function requireRoles (...roles) {
  if (!roleEnforcementEnabled()) {
    return { strategy: 'session' }
  }

  const required = new Set([...roles, ROLES.VIEWER])

  return {
    strategy: 'session',
    access: { scope: [...required].map((role) => `+${role}`) }
  }
}

export { requireRoles }
