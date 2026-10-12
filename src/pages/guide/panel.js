const SESSION_KEY = 'guide-panel-collapsed'

/**
 * Whether the user has collapsed the "About this guide" panel, for every
 * guide they read.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {boolean}
 */
function isPanelCollapsed (request) {
  return request.yar.get(SESSION_KEY) === true
}

/**
 * @param {import('@hapi/hapi').Request} request
 * @param {boolean} collapsed
 */
function setPanelCollapsed (request, collapsed) {
  request.yar.set(SESSION_KEY, collapsed)
}

export {
  isPanelCollapsed,
  setPanelCollapsed
}
