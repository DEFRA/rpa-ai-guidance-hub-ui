import { keepPreferences, preferencesOf } from '../../services/preferences.js'

/**
 * Whether the user has folded the side navigation away to its icons, for
 * every page they open, on any device. Open until they do.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<boolean>}
 */
async function isNavCollapsed (request) {
  return (await preferencesOf(request)).sideNavCollapsed === true
}

/**
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {boolean} collapsed
 * @returns {Promise<void>}
 */
async function setNavCollapsed (request, collapsed) {
  await keepPreferences(request, { sideNavCollapsed: collapsed })
}

export {
  isNavCollapsed,
  setNavCollapsed
}
