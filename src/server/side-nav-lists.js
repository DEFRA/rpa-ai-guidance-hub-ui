import * as usersService from '../services/users.js'

const UNTITLED = 'Untitled guide'

/**
 * @private
 * The user's pinned guides as the side navigation lists them: each with its
 * address, and its position, which its menu's forms send back.
 *
 * @param {Array<{id: string, title: string|null}>} pinned - In the user's order
 * @returns {Array<object>}
 */
function _pinnedGuides (pinned) {
  return pinned.map((pin, position) => ({
    id: pin.id,
    title: pin.title ?? UNTITLED,
    href: `/guides/${encodeURIComponent(pin.id)}`,
    position,
    isFirst: position === 0,
    isLast: position === pinned.length - 1
  }))
}

/**
 * Gives a signed-in page what its side navigation shows of the user's own
 * lists - the guides they pinned - from one call to the hub for the user.
 * Without them, the side navigation lists no pins.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<symbol>}
 */
async function addSideNavLists (request, h) {
  const { response } = request

  if (response.variety !== 'view' || !request.auth.isAuthenticated) {
    return h.continue
  }

  const pinned = await usersService.pinnedOf(request)

  response.source.context = {
    ...response.source.context,
    pinnedGuides: _pinnedGuides(pinned ?? [])
  }

  return h.continue
}

export { addSideNavLists }
