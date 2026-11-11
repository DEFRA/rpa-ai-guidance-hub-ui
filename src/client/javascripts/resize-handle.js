/**
 * @module A handle on the trailing edge of something resizable - the guide's
 * contents column, and the open side navigation - as the prototype's
 * side-nav.js has them: dragged by its
 * edge, or moved with the arrow keys, Home and End, between the handle's
 * `aria-valuemin` and `aria-valuemax`; a double-click puts it back to its
 * default. The width holds until the next page. Without JavaScript the handle
 * stays hidden, and the width is the default.
 */

/**
 * @typedef {{min: number, max: number}} WidthLimits
 */

/**
 * What a handle resizes: the CSS custom property that holds the width, set on
 * the element it applies to, which has a class of its own while dragging.
 *
 * @typedef {Object} Resizable
 * @property {string} handle - The handle's selector
 * @property {string} scope - The selector of the handle's ancestor that the
 *   property is set on
 * @property {string} property - The custom property, `--…`
 * @property {string} resizingClass - On the scope while dragging
 */

// How far one press of an arrow key moves the edge, in pixels.
const STEP = 20

// What each key does to the width. The handle is on the right-hand edge, so
// the right arrow widens it.
const KEYED_WIDTHS = {
  ArrowLeft: (width) => width - STEP,
  ArrowRight: (width) => width + STEP,
  Home: (_width, { min }) => min,
  End: (_width, { max }) => max
}

/**
 * @param {number} width - In pixels
 * @param {WidthLimits} limits
 * @returns {number} `width` as a whole number within the limits
 */
function clampWidth (width, { min, max }) {
  return Math.min(Math.max(Math.round(width), min), max)
}

/**
 * @param {string} key - The `key` of a keyboard event
 * @param {number} width - The width now, in pixels
 * @param {WidthLimits} limits
 * @returns {number|null} The width the key gives, or null for a key that
 *   does not resize
 */
function keyedWidth (key, width, limits) {
  const move = Object.hasOwn(KEYED_WIDTHS, key) ? KEYED_WIDTHS[key] : null

  return move ? clampWidth(move(width, limits), limits) : null
}

// The things that can be resized, each by its handle.
const RESIZABLES = Object.freeze([
  { handle: '[data-guide-contents-resize]', scope: '.app-guide-reading', property: '--app-guide-toc-width', resizingClass: 'app-guide-reading--resizing' },
  { handle: '[data-side-nav-resize]', scope: '.app-layout', property: '--app-side-nav-width', resizingClass: 'app-layout--resizing' }
])

class ResizeHandle {
  #handle
  #resizable
  #scope
  #limits
  #dragStart = null

  /**
   * @param {HTMLElement} handle
   * @param {Resizable} resizable
   */
  constructor (handle, resizable) {
    this.#handle = handle
    this.#resizable = resizable
    this.#scope = handle.closest(resizable.scope)
    this.#limits = {
      min: Number(handle.getAttribute('aria-valuemin')),
      max: Number(handle.getAttribute('aria-valuemax'))
    }
  }

  attach () {
    const handle = this.#handle

    handle.addEventListener('pointerdown', event => this.#startDrag(event))
    handle.addEventListener('pointermove', event => this.#drag(event))
    handle.addEventListener('pointerup', () => this.#endDrag())
    handle.addEventListener('pointercancel', () => this.#endDrag())
    handle.addEventListener('keydown', event => this.#onKey(event))
    handle.addEventListener('dblclick', () => this.#setWidth(Number(handle.dataset.defaultWidth)))
    handle.hidden = false
  }

  // The width the handle last set, or the one the page was drawn at.
  #width () {
    return Number(this.#handle.getAttribute('aria-valuenow'))
  }

  #setWidth (value) {
    const width = clampWidth(value, this.#limits)

    this.#scope.style.setProperty(this.#resizable.property, `${width}px`)
    this.#handle.setAttribute('aria-valuenow', String(width))
    this.#handle.setAttribute('aria-valuetext', `${width} pixels wide`)
  }

  #startDrag (event) {
    this.#dragStart = { x: event.clientX, width: this.#width() }
    this.#handle.setPointerCapture(event.pointerId)
    this.#scope.classList.add(this.#resizable.resizingClass)
    event.preventDefault()
  }

  #drag (event) {
    if (this.#dragStart) {
      this.#setWidth(this.#dragStart.width + event.clientX - this.#dragStart.x)
    }
  }

  #endDrag () {
    this.#dragStart = null
    this.#scope.classList.remove(this.#resizable.resizingClass)
  }

  #onKey (event) {
    const width = keyedWidth(event.key, this.#width(), this.#limits)

    if (width !== null) {
      event.preventDefault()
      this.#setWidth(width)
    }
  }
}

/**
 * Lets the user resize what the page has handles for.
 *
 * @returns {void}
 */
function initResizeHandles () {
  RESIZABLES.forEach((resizable) => {
    const handle = document.querySelector(resizable.handle)

    if (handle) {
      new ResizeHandle(handle, resizable).attach()
    }
  })
}

export { clampWidth, initResizeHandles, keyedWidth }
