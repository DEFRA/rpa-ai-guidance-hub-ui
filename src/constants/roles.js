const ROLES = {
  VIEWER: 'Hub.Viewer',
  EDITOR: 'Hub.Editor'
}

const ROLE_DISPLAY_NAMES = new Map([
  [ROLES.VIEWER, 'Viewer'],
  [ROLES.EDITOR, 'Designer']
])

/**
 * The display names of the hub's roles among `roles`, in the hub's order,
 * leaving out any role the hub does not know.
 *
 * @param {string[]} roles
 * @returns {string[]}
 */
function roleDisplayNames (roles) {
  return [...ROLE_DISPLAY_NAMES]
    .filter(([role]) => roles.includes(role))
    .map(([, name]) => name)
}

export { ROLES, roleDisplayNames }
