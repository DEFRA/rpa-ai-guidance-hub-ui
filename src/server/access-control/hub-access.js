import { config } from '../../config/config.js'
import { ROLES } from '../../constants/roles.js'

const ACCESS_DENIED_PATH = '/access-denied'

// Where a user who can use the hub is sent when a page needs a role they lack,
// and the flash key carrying the names of the roles they are missing there.
const ROLE_REQUIRED_PATH = '/access-denied/role-required'
const MISSING_ROLES_FLASH_KEY = 'missingRoles'

/**
 * Whether roles are enforced at all: the `auth.enforceRoles` flag, the one
 * place the rest of access control reads it. While off, any signed-in user can
 * use everything.
 *
 * @returns {boolean}
 */
function roleEnforcementEnabled () {
  return config.get('auth.enforceRoles')
}

/**
 * Whether the user may use the hub: always when roles are not enforced,
 * otherwise only with Hub.Viewer.
 *
 * @param {import('../plugins/auth/auth.js').SessionCredentials} credentials
 * @returns {boolean}
 */
function canUseHub (credentials) {
  if (!roleEnforcementEnabled()) {
    return true
  }

  return credentials.roles.includes(ROLES.VIEWER)
}

export {
  ACCESS_DENIED_PATH,
  MISSING_ROLES_FLASH_KEY,
  ROLE_REQUIRED_PATH,
  canUseHub,
  roleEnforcementEnabled
}
