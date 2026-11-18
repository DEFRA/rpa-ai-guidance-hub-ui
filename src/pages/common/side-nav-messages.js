/**
 * @module What the side navigation says when a list of the user's is empty,
 * named once, so that one test holds their words and the rest name them. The
 * views plugin gives them to every page, as `sideNavMessages`, for
 * `side-nav.njk` to print.
 */

const SIDE_NAV_MESSAGES = Object.freeze({
  nonePinned: "You haven't pinned any guidance yet.",
  noCaseBookmarks: "You haven't bookmarked any guidance to a case yet."
})

export { SIDE_NAV_MESSAGES }
