/**
 * @fileoverview Holding the panes on the same section of the document.
 *
 * The panes are three lengths of the same document -- the diff carries both sides of
 * every changed line, the rendering carries none of the markup -- so a shared scroll
 * offset means nothing a page in, and a shared fraction of the way down means little
 * more. What they do share is the headings, so the panes are locked to each other by
 * section: scroll one of them into a section the others are not showing, and they are
 * put at the top of it.
 *
 * Which leaves scrolling *within* a section moving nothing else, and that is the half
 * that makes this bearable to use. A pane locked to the exact position of another has
 * to be fought whenever the reader wants to look a little further down one of them; a
 * pane that only moves when the section changes lets them.
 *
 * Sections are named by `sections.js` and marked on the elements that open them, so
 * all that is needed here is `[data-section]`.
 */

// How near the top of a pane a heading has to be to count as the section being read.
// Enough to absorb the rounding in a position we set ourselves, no more: a larger
// allowance would start claiming the section below.
const AT_TOP = 2

/**
 * What turns a viewport coordinate into a scroll position in this pane.
 *
 * Read once per pass rather than per heading: it is the same for all of them, and
 * every rect asked for during a scroll is a layout the browser has to settle.
 *
 * @param {HTMLElement} container
 * @returns {number}
 */
function origin (container) {
  return container.getBoundingClientRect().top - container.scrollTop
}

/**
 * @param {HTMLElement} anchor
 * @param {number} from
 * @returns {number} where the anchor sits in its pane's scroll coordinates
 */
function offset (anchor, from) {
  return anchor.getBoundingClientRect().top - from
}

/**
 * The section a pane is showing: the last heading at or above its top edge.
 *
 * Found by halving rather than scanning, because the anchors are in document order
 * and this runs on every scroll event of every pane.
 *
 * @param {object} pane
 * @returns {string|null} null while the pane is still above the first heading
 */
function sectionAt (pane) {
  const from = origin(pane.container)
  const top = pane.container.scrollTop + AT_TOP

  let low = 0
  let high = pane.anchors.length - 1
  let found = null

  while (low <= high) {
    const middle = (low + high) >> 1

    if (offset(pane.anchors[middle], from) <= top) {
      found = pane.anchors[middle]
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return found ? found.dataset.section : null
}

/**
 * Put a pane at the top of a section, if it has one.
 *
 * A pane that never received the section -- a heading the schema dropped, say -- is
 * left where it is rather than moved somewhere arbitrary.
 *
 * @param {object} pane
 * @param {string|null} section
 */
function show (pane, section) {
  const { container } = pane
  const anchor = section === null
    ? null
    : pane.anchors.find((candidate) => candidate.dataset.section === section)

  if (section !== null && !anchor) {
    return
  }

  const wanted = anchor ? offset(anchor, origin(container)) : 0
  // Clamped here rather than left to the browser so that `settling` is set to the
  // position the pane will actually come to rest at: the last section of a short
  // pane cannot be brought to the top, and asking for it twice must not look like
  // a reader scrolling.
  const target = Math.max(
    0,
    Math.min(wanted, container.scrollHeight - container.clientHeight)
  )

  if (Math.abs(container.scrollTop - target) < 1) {
    return
  }

  pane.settling = target
  container.scrollTop = target
}

/**
 * Bring every other pane to the section this one is showing.
 *
 * @param {object} leader
 */
function align (leader) {
  const section = sectionAt(leader)

  for (const pane of leader.others) {
    if (sectionAt(pane) !== section) {
      show(pane, section)
    }
  }
}

/**
 * A pane's own scrolling, told apart from the scrolling we just did to it.
 *
 * Moving a pane raises the same event a reader would, so without this the first
 * pane to be aligned would turn round and align the pane that moved it. The position
 * is checked as well as the flag: a pane that a reader took hold of before its
 * event arrived is answering for itself, and one we moved twice in a frame raises a
 * single event that still matches the second position.
 *
 * @param {object} pane
 * @returns {boolean}
 */
function isSettling (pane) {
  const settled = pane.settling !== null &&
    Math.abs(pane.container.scrollTop - pane.settling) < 1

  pane.settling = null

  return settled
}

/**
 * Lock a set of scrolling containers to each other by section.
 *
 * @param {HTMLElement[]} containers
 * @returns {{ refresh: () => void, alignFrom: (container: HTMLElement) => void }}
 *   `refresh` re-reads the headings, for a pane whose contents have been replaced;
 *   `alignFrom` brings the others to the named pane without waiting to be scrolled.
 */
function linkPanes (containers) {
  const panes = containers.map((container) => ({
    container,
    anchors: [],
    settling: null
  }))

  const refresh = () => {
    for (const pane of panes) {
      pane.anchors = [...pane.container.querySelectorAll('[data-section]')]
    }
  }

  for (const pane of panes) {
    pane.others = panes.filter((other) => other !== pane)

    pane.container.addEventListener('scroll', () => {
      if (!isSettling(pane)) {
        align(pane)
      }
    // Nothing here cancels the scroll it is answering.
    }, { passive: true })
  }

  refresh()

  return {
    refresh,
    alignFrom: (container) =>
      align(panes.find((pane) => pane.container === container))
  }
}

export { linkPanes }
