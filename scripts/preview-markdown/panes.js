/**
 * @fileoverview Draggable splits between the viewer's panes.
 *
 * The three panes show the same document at different stages, and which one needs
 * the room depends entirely on what is being looked at: a wide table wants the
 * rendering, a long diff wants the middle pane, and reading the source against the
 * diff wants the left column. A fixed half-and-half is wrong for all three.
 *
 * Each grid keeps its split as a bare fraction in a custom property and does the
 * arithmetic in CSS, so the panes stay proportional when the window is resized --
 * which storing pixels would not. The fraction is of the space the two panes share
 * rather than of the grid, so the gutter between them cannot bias it.
 */

// Enough of a pane left to see what is in it, and to grab the gutter again.
const SMALLEST = 0.12
const STEP = 0.02

const AXES = {
  vertical: {
    property: '--split-columns',
    cursor: 'col-resize',
    extent: 'width',
    edge: 'left',
    coordinate: 'clientX',
    steps: { ArrowLeft: -1, ArrowRight: 1 }
  },
  horizontal: {
    property: '--split-rows',
    cursor: 'row-resize',
    extent: 'height',
    edge: 'top',
    coordinate: 'clientY',
    steps: { ArrowUp: -1, ArrowDown: 1 }
  }
}

/**
 * @param {number} fraction
 * @returns {number} the same fraction, with both panes left something to show
 */
function settle (fraction) {
  return Math.min(Math.max(fraction, SMALLEST), 1 - SMALLEST)
}

/**
 * The two panes a separator sits between, and the space they share.
 *
 * @param {HTMLElement} separator
 * @param {object} axis
 * @returns {{ before: number, shared: number }} in pixels
 */
function measure (separator, axis) {
  const before = separator.previousElementSibling.getBoundingClientRect()
  const after = separator.nextElementSibling.getBoundingClientRect()

  return {
    before: before[axis.extent],
    shared: before[axis.extent] + after[axis.extent]
  }
}

/**
 * Move a split, and say where it went.
 *
 * @param {HTMLElement} separator
 * @param {object} axis
 * @param {number} fraction
 */
function place (separator, axis, fraction) {
  const settled = settle(fraction)

  separator.parentElement.style.setProperty(axis.property, String(settled))
  separator.setAttribute('aria-valuenow', String(Math.round(settled * 100)))
}

/**
 * Follow the pointer until it is let go.
 *
 * The grab point is taken once and the movement added to it, rather than the split
 * being put wherever the pointer is: the pointer starts somewhere inside a gutter
 * that has width, and reading its position directly would jump the split by however
 * far from the centre it was pressed.
 *
 * @param {HTMLElement} separator
 * @param {object} axis
 * @param {PointerEvent} event
 */
function grab (separator, axis, event) {
  const { before, shared } = measure(separator, axis)

  if (!shared) {
    return
  }

  const origin = event[axis.coordinate]

  const move = (moved) =>
    place(separator, axis, (before + moved[axis.coordinate] - origin) / shared)

  const release = () => {
    separator.removeEventListener('pointermove', move)
    document.body.classList.remove('is-dragging')
    document.body.style.cursor = ''
  }

  // Captured so the split keeps following a pointer that has left the gutter, which
  // it does immediately: the gutter is a few pixels wide and hands move faster.
  separator.setPointerCapture(event.pointerId)
  document.body.classList.add('is-dragging')
  document.body.style.cursor = axis.cursor

  separator.addEventListener('pointermove', move)
  separator.addEventListener('pointerup', release, { once: true })
  separator.addEventListener('pointercancel', release, { once: true })

  // Otherwise the drag selects the text of the pane it passes over.
  event.preventDefault()
}

/**
 * @param {HTMLElement} separator
 * @param {object} axis
 * @param {KeyboardEvent} event
 */
function nudge (separator, axis, event) {
  const direction = axis.steps[event.key]

  if (!direction) {
    return
  }

  const { before, shared } = measure(separator, axis)

  place(separator, axis, before / shared + direction * STEP)
  event.preventDefault()
}

/**
 * Wire up every gutter on the page.
 *
 * The separators are in the markup rather than inserted here, because they are grid
 * tracks: a gutter that the stylesheet does not know about would have no column to
 * sit in.
 */
function makeResizable () {
  for (const separator of document.querySelectorAll('.gutter')) {
    const axis = AXES[separator.getAttribute('aria-orientation')]

    separator.addEventListener('pointerdown', (event) => grab(separator, axis, event))
    separator.addEventListener('keydown', (event) => nudge(separator, axis, event))
    // The way back from any arrangement, without hunting for the middle.
    separator.addEventListener('dblclick', () => place(separator, axis, 0.5))
  }
}

export { makeResizable }
