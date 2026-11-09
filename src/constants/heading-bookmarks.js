/**
 * @module A heading's controls - its star, which pins its section, and its
 * bookmark, which bookmarks it to a case - and the line under it saying which
 * cases it is bookmarked to, as the prototype has them. Shared by the page's
 * own section headings, the server-rendered fallback and the client viewer,
 * so a heading looks the same whichever drew it.
 */

/**
 * @typedef {Object} HeadingPin
 * @property {string} guideId
 * @property {string} section - The anchor the hub knows the heading's section
 *   by
 * @property {string} anchor - The heading's anchor on the page, to come back to
 * @property {string} returnTo - The page, to come back to
 * @property {{position: number, sectionId: string, key: string}|null} pinned
 *   - Where the user's pins have the heading's section; null when it is not
 *   pinned
 */

/**
 * @typedef {Object} HeadingBookmark
 * @property {string} href - The question that bookmarks the heading's section
 * @property {string|null} bookmarkedTo - The cases it is bookmarked to
 *   (`Case W1234567, SBI 123456789`); null for none
 * @property {HeadingPin|null} [pin] - Its star; none when the user's pins are
 *   not known
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
// The star that pins a guide in the hub, outlined until the section is pinned.
const STAR_PATH = 'm10 3 2.1 4.4 4.8.6-3.5 3.3.9 4.8L10 13.8l-4.3 2.3.9-4.8L3.1 8l4.8-.6z'
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
 * The star after a heading, which pins its section at once, or unpins it from
 * where the user's pins have it: a form, so it works without JavaScript. A
 * pinned section's star names the pin it follows (`data-reorder-follows`), so
 * a drag in the side navigation keeps the position it sends up to date.
 *
 * @param {HeadingPin} pin
 * @param {string} heading - The heading's text
 * @returns {string} HTML
 */
function headingPinHtml ({ guideId, section, anchor, returnTo, pinned }, heading) {
  const label = pinned ? 'Unpin section' : 'Pin section'
  const fields = pinned
    ? { guideId, pin: 'false', position: pinned.position, sectionId: pinned.sectionId, section, anchor, returnTo }
    : { guideId, pin: 'true', section, anchor, returnTo }
  const follows = pinned ? ` data-reorder-follows="${_escape(pinned.key)}"` : ''

  return [
    `<form class="app-guide-section-pin" method="post" action="/pin-toggle"${follows}>`,
    ...Object.entries(fields).map(([name, value]) => `<input type="hidden" name="${name}" value="${_escape(value)}">`),
    `<button type="submit" class="app-guide-section-pin__button${pinned ? ' app-guide-section-pin__button--active' : ''}" data-side-nav-tooltip>`,
    `<svg ${ICON_ATTRIBUTES}><path${pinned ? ' fill="currentColor"' : ''} d="${STAR_PATH}"/></svg>`,
    `<span class="govuk-visually-hidden">${label}: ${_escape(heading)}</span>`,
    `<span class="app-side-nav__tooltip app-side-nav__tooltip--left app-guide-section-bookmark__tooltip" aria-hidden="true">${label}</span>`,
    '</button>',
    '</form>'
  ].join('')
}

/**
 * The controls after a heading: its star, when the user's pins are known,
 * then its bookmark.
 *
 * @param {HeadingBookmark} controls
 * @param {string} heading - The heading's text
 * @returns {string} HTML
 */
function headingControlsHtml (controls, heading) {
  return (controls.pin ? headingPinHtml(controls.pin, heading) : '') + headingBookmarkHtml(controls, heading)
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
  headingBookmarkHtml,
  headingControlsHtml,
  headingPinHtml
}
