/**
 * @module A guide's contents follow the reader, as the prototype's
 * guide-toc.js has them. As the reader scrolls, the entry for the heading
 * they are reading is marked as where they are (`aria-current="location"`)
 * and kept in sight in the contents pane's own scroll. In the stepper the
 * page's own entry is marked already, as the page (`aria-current="page"`);
 * within the page, the heading is.
 *
 * The address stays as it arrived - a link from elsewhere names its place
 * twice, `?section=…#…` - until the reader's first move. From then on it names
 * the place they are reading, once, so a reload or a copied address comes
 * back there: in the traditional view the heading as the fragment, with no
 * `section`; in the stepper the heading as `section`, with no fragment. It is
 * replaced, never added to the history. Without JavaScript the contents and
 * the address stay as the browser has them.
 */

import { readerPlace, readingLine } from './guide-place.js'

// The attribute that marks an entry as where the reader is, as LOCATION, or
// as the stepper's own page.
const CURRENT = 'aria-current'
const LOCATION = 'location'

// The heading each entry goes to (page.njk); empty for a section without one.
const ENTRIES = '[data-guide-contents-target]'

// What the reader does to move through the guide: the wheel, a touch, a key,
// a press on the page or its scroll bar, or a jump within the page. The
// browser's own scrolling, to a link's fragment, is none of them.
const MOVES = Object.freeze(['wheel', 'touchmove', 'keydown', 'pointerdown', 'hashchange'])

/**
 * @param {{pathname: string, search: string, hash: string}} location - The
 *   page's
 * @param {{anchor: string, page: string}} place - The heading being read
 *   (empty where the reader has reached none, at the start of the guide or of
 *   a stepper page), and the anchor its page is named by (empty for a first
 *   page without a heading)
 * @param {boolean} isStepper - Whether the guide is shown a section at a time
 * @returns {string|null} The address that names the place once, the rest of
 *   the query kept: the heading as the fragment, without `section`, in the
 *   traditional view; the heading, or else the page, as `section`, without a
 *   fragment, in the stepper. Null when the address names the place already.
 */
function followedAddress ({ pathname, search, hash }, { anchor, page }, isStepper) {
  const query = new URLSearchParams(search)
  const section = isStepper ? anchor || page : ''

  query.delete('section')

  if (section) {
    query.set('section', section)
  }

  const rest = query.toString()
  const fragment = !isStepper && anchor ? `#${encodeURIComponent(anchor)}` : ''
  const address = `${pathname}${rest ? `?${rest}` : ''}${fragment}`

  return address === `${pathname}${search}${hash}` ? null : address
}

/**
 * @param {{search: string, hash: string}} location - The page's
 * @returns {boolean} Whether its `section` and its fragment name different
 *   places, as an address can after the reader has moved about without
 *   JavaScript
 */
function namesTwoPlaces ({ search, hash }) {
  const section = new URLSearchParams(search).get('section')
  const fragment = decodeURIComponent(hash.slice(1))

  return section !== null && fragment !== '' && section !== fragment
}

/**
 * @param {{top: number, anchor: string}} place - The entry `readerPlace`
 *   chose
 * @param {number} line - The reading line it chose it by
 * @returns {string} The anchor the address names: the entry's, once the
 *   reader has reached its heading; none above the first heading, at the
 *   start of the guide, though that entry is marked as the nearest
 */
function anchorRead ({ top, anchor }, line) {
  return top <= line ? anchor : ''
}

/**
 * @param {{top: number, bottom: number}} entry - Where the entry is
 * @param {{top: number, bottom: number}} inSight - The part of the contents
 *   in sight
 * @returns {number} How far to scroll the contents to bring the entry into
 *   sight: back (negative) for one above, on for one below, 0 for one in it
 */
function scrollShowing (entry, inSight) {
  return Math.min(0, entry.top - inSight.top) + Math.max(0, entry.bottom - inSight.bottom)
}

/**
 * @private
 * @param {HTMLAnchorElement} link - A contents entry
 * @returns {{element: HTMLElement|null, anchor: string}} Where on the page
 *   the entry goes: its heading; or, for a section without one, or the
 *   stepper's own page, the page's start, which has no anchor
 */
function _placeOf (link) {
  const anchor = link.dataset.guideContentsTarget

  if (anchor && link.getAttribute(CURRENT) !== 'page') {
    return { element: document.getElementById(anchor), anchor }
  }

  const { guideContentsPage } = link.closest('[data-guide-contents-page]').dataset

  return { element: document.querySelector(`[data-guide-page="${guideContentsPage}"]`), anchor: '' }
}

/**
 * @private
 * @returns {Array<{top: number, link: HTMLAnchorElement, anchor: string}>}
 *   The entries for places on the pages shown, in page order. A stepper page
 *   not being read is hidden until found, which still lays its headings out,
 *   so a layout box alone doesn't mean a heading is shown.
 */
function _entries () {
  return Array.from(document.querySelectorAll(ENTRIES)).flatMap((link) => {
    const { element, anchor } = _placeOf(link)
    const isShown = element && !element.closest('[hidden]') && element.getClientRects().length > 0

    return isShown ? [{ top: element.getBoundingClientRect().top, link, anchor }] : []
  })
}

/**
 * @private
 * @returns {string} The anchor the page shown is named by: in the stepper, the
 *   one page; empty for a first page without a heading
 */
function _pageShown () {
  const href = document.querySelector('[data-guide-page]:not([hidden])')?.dataset.guidePageHref

  return href ? new URL(href, window.location.href).searchParams.get('section') ?? '' : ''
}

/**
 * @private
 * @param {() => void} callback - Called once, at the reader's first move; or
 *   as the page finishes loading, when its address names two places
 */
function _atFirstMove (callback) {
  const once = () => {
    MOVES.forEach(type => window.removeEventListener(type, once, true))
    window.removeEventListener('load', once)
    callback()
  }

  MOVES.forEach(type => window.addEventListener(type, once, { capture: true, passive: true }))

  if (namesTwoPlaces(window.location)) {
    window.addEventListener('load', once)
  }
}

/**
 * Lets a guide's contents and address follow the reader, if the page is a
 * guide's.
 *
 * @returns {void}
 */
function initGuideContents () {
  const contents = document.querySelector('.app-guide-contents')

  if (!contents) {
    return
  }

  const isStepper = contents.dataset.guideFormat === 'stepper'
  let reached = null
  let ticking = false
  let hasMoved = false

  // The stepper's own page is marked already, as the page.
  const mark = (link) => {
    contents.querySelector(`[${CURRENT}="${LOCATION}"]`)?.removeAttribute(CURRENT)

    if (link.getAttribute(CURRENT) !== 'page') {
      link.setAttribute(CURRENT, LOCATION)
    }

    const box = contents.getBoundingClientRect()
    const inSight = { top: Math.max(box.top, 0), bottom: Math.min(box.bottom, window.innerHeight) }

    contents.scrollBy(0, scrollShowing(link.getBoundingClientRect(), inSight))
  }

  const follow = (anchor) => {
    const address = followedAddress(window.location, { anchor, page: _pageShown() }, isStepper)

    if (address) {
      window.history.replaceState(window.history.state, '', address)
    }
  }

  const update = () => {
    ticking = false
    const line = readingLine()
    const place = readerPlace(_entries(), line)

    if (place && place.link !== reached) {
      reached = place.link
      mark(place.link)
    }
    if (place && hasMoved) {
      follow(anchorRead(place, line))
    }
  }

  const onScroll = () => {
    if (!ticking) {
      ticking = true
      window.requestAnimationFrame(update)
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  // A jump to a place already in view scrolls nothing, but moves the address.
  window.addEventListener('hashchange', onScroll)
  _atFirstMove(() => {
    hasMoved = true
    onScroll()
  })
  update()
}

export { anchorRead, followedAddress, initGuideContents, namesTwoPlaces, scrollShowing }
