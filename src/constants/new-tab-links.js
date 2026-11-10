/**
 * @module Which of a guide's links open in a new tab, and the words that say
 * so. Shared by the server-drawn guide and the viewer, so a link behaves the
 * same whichever drew it. The icon is the stylesheet's.
 */

// An address with a host of its own leaves the hub; the guide's links within
// it are paths and fragments.
const LEAVES_THE_HUB = /^(https?:)?\/\//i

/** What a screen reader hears after the link's own text. */
const NEW_TAB_TEXT = ' (opens in new tab)'

/**
 * @param {string} href - A link's address, as the guide has it
 * @returns {boolean} Whether the link opens in a new tab: only one that
 *   leaves the hub does
 */
function opensInNewTab (href) {
  return LEAVES_THE_HUB.test(href)
}

export { NEW_TAB_TEXT, opensInNewTab }
