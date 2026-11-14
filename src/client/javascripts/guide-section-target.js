/**
 * @module Where a stepper address that names only a section - `?section=…`,
 * as the address follows the reader (guide-contents.js) and as a copy of it
 * is opened in a fresh page - takes the reader. The server picks the page; it
 * is the browser that goes to a heading, and only for a fragment.
 */

// The contents' entries for headings inside a section; a section's own
// heading is the start of its page, where the reader already is.
const SUBHEADING_ENTRIES = '.app-guide-contents__link'

/**
 * @param {{search: string, hash: string}} location - The page's
 * @param {Document} doc
 * @returns {HTMLElement|null} The heading the address names by `section`,
 *   found by way of the contents' entry, which has both the anchor the stepper
 *   names it by and the heading's anchor on the page, as the two can differ.
 *   Null when the address has a fragment, which says where to go, or names no
 *   heading inside a section.
 */
function sectionTarget (location, doc) {
  const section = new URLSearchParams(location.search).get('section')

  if (!section || location.hash.length > 1) {
    return null
  }

  const entries = Array.from(doc.querySelectorAll(SUBHEADING_ENTRIES))
  const entry = entries.find(link => link.dataset.guideContentsSection === section)

  return entry ? doc.getElementById(entry.dataset.guideContentsTarget) : null
}

export { sectionTarget }
