const ROLES = {
  VIEWER: 'Hub.Viewer',
  EDITOR: 'Hub.Editor',
  ADMIN: 'Hub.Admin'
}

const ROLE_DISPLAY_NAMES = new Map([
  [ROLES.VIEWER, 'Viewer'],
  [ROLES.EDITOR, 'Designer'],
  [ROLES.ADMIN, 'Administrator']
])

/**
 * The hub's roles among `roles`, in the hub's order, leaving out any role the
 * hub does not know. A session stored before roles were added has none.
 *
 * @param {string[]} [roles]
 * @returns {string[]}
 */
function knownRoles (roles = []) {
  return [...ROLE_DISPLAY_NAMES.keys()].filter((role) => roles.includes(role))
}

/**
 * The display names of the hub's roles among `roles`, in the hub's order,
 * leaving out any role the hub does not know.
 *
 * @param {string[]} roles
 * @returns {string[]}
 */
function roleDisplayNames (roles) {
  return knownRoles(roles).map((role) => ROLE_DISPLAY_NAMES.get(role))
}

export { ROLES, knownRoles, roleDisplayNames }
