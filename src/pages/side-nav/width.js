import { preferencesOf } from '../../services/preferences.js'

/**
 * The side navigation's width when it is open, in pixels, as the prototype
 * has it. The stylesheet's `$app-side-nav-width`, `$app-side-nav-min-width`
 * and `$app-side-nav-max-width` match it.
 */
const SIDE_NAV_WIDTH = Object.freeze({ min: 220, max: 440, default: 280 })

/**
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<number>} The width the user left the open side navigation
 *   at, on any device
 */
async function getSideNavWidth (request) {
  return (await preferencesOf(request)).sideNavWidth ?? SIDE_NAV_WIDTH.default
}

export { getSideNavWidth, SIDE_NAV_WIDTH }
