import { CASE_TYPES } from '../constants/case-types.js'
import { caseGuidesHref } from '../pages/common/case-guides-href.js'
import { guideSectionHref } from '../pages/common/guide-section-href.js'
import { isNavCollapsed } from '../pages/side-nav/collapsed.js'
import { getSideNavWidth } from '../pages/side-nav/width.js'
import { preferencesOf } from '../services/preferences.js'
import * as usersService from '../services/users.js'

const UNTITLED = 'Untitled guide'

/**
 * @private
 * @param {number} position
 * @param {number} count
 * @returns {{position: number, isFirst: boolean, isLast: boolean}} Where an
 *   item is in its list, which its menu's moves send
 */
function _placed (position, count) {
  return { position, isFirst: position === 0, isLast: position === count - 1 }
}

/**
 * @private
 * The user's pins as the side navigation lists them: a guide by its title, a
 * section by its heading, with its guide's title. Each is named by its key,
 * with its address, and its position, which its menu's forms send back.
 *
 * @param {Array<{id: string, title: string|null, sectionId: string|null, section: string|null, heading: string|null}>} pinned
 *   - In the user's order
 * @returns {Array<object>}
 */
function _pins (pinned) {
  return pinned.map((pin, position) => {
    const title = pin.title ?? UNTITLED
    const href = `/guides/${encodeURIComponent(pin.id)}`

    return {
      key: usersService.pinKey(pin),
      id: pin.id,
      sectionId: pin.sectionId,
      label: pin.sectionId ? pin.heading ?? pin.section ?? title : title,
      guideTitle: pin.sectionId ? title : null,
      href: pin.section ? guideSectionHref(pin.id, pin.section) : href,
      ..._placed(position, pinned.length)
    }
  })
}

/**
 * @private
 * The user's cases as the side navigation lists them: each named by its type
 * and reference, kept by its key, and linking to the Bookmarked guides page
 * narrowed to it, with its guides, each linking to the guide, and each guide's
 * bookmarked sections, each linking to its place in the guide. Each list
 * carries the ids it shows, which its moves send back.
 *
 * @param {Array<{key: string, type: string, ref: string, guides: Array<{id: string, title: string|null, bookmarks: Array<{sectionId: string, section: string, heading: string|null}>}>}>} cases
 *   - In the user's order
 * @returns {{cases: Array<object>, order: string[]}}
 */
function _caseBookmarks (cases) {
  return {
    order: cases.map(({ key }) => key),
    cases: cases.map(({ key, type, ref, guides }, position) => ({
      key,
      typeLabel: CASE_TYPES[type].short,
      ref,
      name: `${CASE_TYPES[type].short} ${ref}`,
      href: caseGuidesHref(key),
      ..._placed(position, cases.length),
      guideOrder: guides.map(({ id }) => id),
      guides: guides.map((guide, at) => {
        const href = `/guides/${encodeURIComponent(guide.id)}`

        return {
          id: guide.id,
          title: guide.title ?? UNTITLED,
          href,
          ..._placed(at, guides.length),
          sections: guide.bookmarks.map(({ sectionId, section, heading }) => ({
            sectionId,
            label: heading ?? section,
            href: guideSectionHref(guide.id, section)
          }))
        }
      })
    }))
  }
}

/**
 * Gives a signed-in page what its side navigation shows of the user's own
 * lists - the guides and sections they pinned, and how many, and their cases
 * with the sections of guides bookmarked to them, and how many - from one call
 * to the hub for the user. Without them, the side navigation lists no pins or
 * cases and counts none. With them, whether the user has folded the side
 * navigation away, its width, and whether each of its lists is closed, from
 * their preferences: the defaults, when they cannot be read.
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

  const [pinned, cases, sideNavCollapsed, sideNavWidth, preferences] = await Promise.all([
    usersService.pinnedOf(request),
    usersService.casesOf(request),
    isNavCollapsed(request),
    getSideNavWidth(request),
    preferencesOf(request)
  ])

  response.source.context = {
    ...response.source.context,
    pins: _pins(pinned ?? []),
    pinnedCount: pinned?.length,
    caseBookmarks: _caseBookmarks(cases ?? []),
    caseCount: cases?.length,
    sideNavCollapsed,
    sideNavWidth,
    sideNavPinnedCollapsed: preferences.sideNavPinnedCollapsed === true,
    sideNavBookmarksCollapsed: preferences.sideNavBookmarksCollapsed === true
  }

  return h.continue
}

export { addSideNavLists }
