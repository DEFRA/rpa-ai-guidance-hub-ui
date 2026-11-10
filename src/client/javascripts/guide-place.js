/**
 * @module Where the reader is in a guide, so that changing its format brings
 * them back to the same place rather than to the page the server showed.
 */

/**
 * @typedef {Object} PlaceMark
 * @property {number} top - How far below the top of the window it is
 * @property {string} href - The address of the page of the guide it is on
 * @property {string} id - A heading's id, or '' for the start of a page
 */

// How far down the window a heading must have scrolled to count as the one
// being read: 120 pixels, or a fifth of a short window (the prototype's
// guide-position.js).
const READING_LINE = 120
const READING_LINE_SHARE = 0.2

/**
 * Where the reader is: the last page start or heading that has scrolled up to
 * the reading line, or the first of them if none has.
 *
 * @param {PlaceMark[]} marks - In the order they are on the page
 * @param {number} line - The reading line, from the top of the window
 * @returns {{href: string, id: string}|null} Null when there are none
 */
function readerPlace (marks, line) {
  const reached = marks.findLast(mark => mark.top <= line) ?? marks[0]

  return reached ? { href: reached.href, id: reached.id } : null
}

/**
 * The address of a place in the guide. It names the page, which the stepper
 * shows, and the heading, which the browser goes to in either format.
 *
 * @param {{href: string, id: string}} place
 * @returns {string}
 */
function placeHref ({ href, id }) {
  return id ? `${href}#${encodeURIComponent(id)}` : href
}

/**
 * @private
 * @returns {PlaceMark[]} Each shown page's start and the headings with an id
 *   on it, in page order
 */
function _placeMarks () {
  const pages = document.querySelectorAll('[data-guide-page]:not([hidden])')

  return Array.from(pages).flatMap((page) => {
    const href = page.dataset.guidePageHref
    const headings = page.querySelectorAll('h2[id], h3[id], h4[id], h5[id], h6[id]')

    return [page, ...headings].map(element => ({
      top: element.getBoundingClientRect().top,
      href,
      id: element === page ? '' : element.id
    }))
  })
}

/**
 * @private
 * @returns {number} The reading line; at the very end of the guide the last
 *   headings can never scroll that high, so there it is the window's foot
 */
function _readingLine () {
  const scroller = document.scrollingElement ?? document.documentElement
  const atEnd = window.innerHeight + window.scrollY >= scroller.scrollHeight - 2

  return atEnd ? window.innerHeight : Math.min(READING_LINE, window.innerHeight * READING_LINE_SHARE)
}

/**
 * Keeps the reader's place when they change the guide's format: as the form
 * is sent, its return address becomes the place they have scrolled to.
 *
 * @returns {void}
 */
function initGuidePlace () {
  const input = document.querySelector('[data-guide-place]')

  input?.form.addEventListener('submit', () => {
    const place = readerPlace(_placeMarks(), _readingLine())

    if (place) {
      input.value = placeHref(place)
    }
  })
}

export { initGuidePlace, placeHref, readerPlace }
