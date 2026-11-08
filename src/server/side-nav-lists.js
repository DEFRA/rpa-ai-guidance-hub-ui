import { CASE_TYPES } from '../constants/case-types.js'
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
 * @private
 * The user's cases as the side navigation lists them: each named by its type
 * and reference, with its guides, each linking to the guide, and each guide's
 * bookmarked sections, each linking to its place in the guide.
 *
 * @param {Array<{type: string, ref: string, guides: Array<{id: string, title: string|null, bookmarks: Array<{section: string, heading: string|null}>}>}>} cases
 *   - In the user's order
 * @returns {Array<object>}
 */
function _caseBookmarks (cases) {
  return cases.map(({ type, ref, guides }) => ({
    typeLabel: CASE_TYPES[type].short,
    ref,
    name: `${CASE_TYPES[type].short} ${ref}`,
    guides: guides.map(guide => {
      const href = `/guides/${encodeURIComponent(guide.id)}`

      return {
        title: guide.title ?? UNTITLED,
        href,
        sections: guide.bookmarks.map(({ section, heading }) => ({
          label: heading ?? section,
          href: `${href}?section=${encodeURIComponent(section)}#${encodeURIComponent(section)}`
        }))
      }
    })
  }))
}

/**
 * Gives a signed-in page what its side navigation shows of the user's own
 * lists - the guides they pinned, and how many, and their cases with the
 * sections of guides bookmarked to them - from one call to the hub for the
 * user. Without them, the side navigation lists no pins or cases and counts
 * none.
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

  const [pinned, cases] = await Promise.all([usersService.pinnedOf(request), usersService.casesOf(request)])

  response.source.context = {
    ...response.source.context,
    pinnedGuides: _pinnedGuides(pinned ?? []),
    pinnedCount: pinned?.length,
    caseBookmarks: _caseBookmarks(cases ?? [])
  }

  return h.continue
}

export { addSideNavLists }
