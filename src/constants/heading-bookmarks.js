/**
 * @module A heading's bookmark control, and the line under it saying which
 * cases it is bookmarked to, as the prototype has them. Shared by the page's
 * own section headings, the server-rendered fallback and the client viewer,
 * so a heading looks the same whichever drew it.
 */

/**
 * @typedef {Object} HeadingBookmark
 * @property {string} href - The question that bookmarks the heading's section
 * @property {string|null} bookmarkedTo - The cases it is bookmarked to
 *   (`Case W1234567, SBI 123456789`); null for none
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

// The side navigation's bookmark icon, outlined until the heading is
// bookmarked, then filled.
const BOOKMARK_PATH = 'M5.5 3.5h9v13L10 13l-4.5 3.5z'
const ICON_ATTRIBUTES = 'class="app-side-nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"'

/**
 * @private
 * @param {string} text
 * @returns {string}
 */
function _escape (text) {
  return String(text).replaceAll(/[&<>"']/g, character => ESCAPES[character])
}

/**
 * The control after a heading: the bookmark icon, named for the heading, its
 * tooltip saying what it does.
 *
 * @param {HeadingBookmark} bookmark
 * @param {string} heading - The heading's text
 * @returns {string} HTML
 */
function headingBookmarkHtml ({ href, bookmarkedTo }, heading) {
  const label = bookmarkedTo ? 'Bookmarked – add another case' : 'Bookmark to a case'
  const fill = bookmarkedTo ? ' fill="currentColor"' : ''

  return [
    `<a class="app-guide-section-bookmark${bookmarkedTo ? ' app-guide-section-bookmark--active' : ''}" href="${_escape(href)}" data-side-nav-tooltip>`,
    `<svg ${ICON_ATTRIBUTES}><path${fill} d="${BOOKMARK_PATH}"/></svg>`,
    `<span class="govuk-visually-hidden">${_escape(label)}: ${_escape(heading)}</span>`,
    `<span class="app-side-nav__tooltip app-side-nav__tooltip--left app-guide-section-bookmark__tooltip" aria-hidden="true">${_escape(label)}</span>`,
    '</a>'
  ].join('')
}

/**
 * Which cases a heading is bookmarked to, as words under it, since a tooltip
 * never shows on a touch screen.
 *
 * @param {HeadingBookmark} bookmark
 * @returns {string} HTML; empty when it is bookmarked to none
 */
function bookmarkedToHtml ({ bookmarkedTo }) {
  return bookmarkedTo ? `<p class="app-guide-section-bookmarked">Bookmarked to ${_escape(bookmarkedTo)}</p>` : ''
}

export {
  bookmarkedToHtml,
  headingBookmarkHtml
}
