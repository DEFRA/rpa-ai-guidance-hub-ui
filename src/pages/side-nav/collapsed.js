const SESSION_KEY = 'side-nav-collapsed'

/**
 * Whether the user has folded the side navigation away to its icons, for
 * every page they open in this session.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {boolean}
 */
function isNavCollapsed (request) {
  return request.yar?.get(SESSION_KEY) === true
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {boolean} collapsed
 */
function setNavCollapsed (request, collapsed) {
  request.yar.set(SESSION_KEY, collapsed)
}

export {
  isNavCollapsed,
  setNavCollapsed
}
