/**
 * Dragging the user's pinned guides into a new order in the side navigation,
 * as the prototype does (rpa-ai-guidance-hub-prototype:
 * app/assets/javascripts/side-nav.js). A pointer drag on a guide's link (past
 * a few pixels, so a click still opens it) moves the guide; a bar shows where
 * it will land, and Esc cancels. The move is sent to the list's
 * `data-reorder-list` address, and a screen reader is told where the guide now
 * is. Move up and Move down in each guide's "…" menu do the same without
 * dragging.
 */

// How far, in pixels, the pointer moves before a press becomes a drag.
const DRAG_THRESHOLD = 5

// What a kept move is answered with: nothing to show. Anything else, even a
// page (as signing in again is), means the move was not kept.
const MOVE_KEPT = 204

const DRAGGING = 'app-side-nav__reorder--dragging'
const DROP_BEFORE = 'app-side-nav__reorder--drop-before'
const DROP_AFTER = 'app-side-nav__reorder--drop-after'
const REORDERING = 'app-layout--reordering'

/**
 * @param {number[]} middles - The vertical middle of each of the other guides,
 *   top to bottom, in pixels
 * @param {number} clientY - Where the dragged guide is, in pixels
 * @returns {number} Where it lands among the others: before the first whose
 *   middle is below it, or after them all
 */
function dropIndex (middles, clientY) {
  const index = middles.findIndex(middle => clientY < middle)

  return index === -1 ? middles.length : index
}

/**
 * @param {number} position - The guide's, counting from 0
 * @param {number} step - -1 to move it up, 1 to move it down
 * @param {number} count - How many guides there are
 * @returns {number|null} Where the step takes it, or null when it has no
 *   neighbour that way
 */
function moveTarget (position, step, count) {
  const target = position + step

  return target >= 0 && target < count ? target : null
}

/**
 * @param {string} label - The guide's title
 * @param {number} position - Where it now is, counting from 0
 * @param {number} count - How many guides there are
 * @returns {string} What a screen reader is told once it is dragged
 */
function movedMessage (label, position, count) {
  return `Moved ${label} to position ${position + 1} of ${count}.`
}

/**
 * The move was not kept - the pins changed since the page showed them, or the
 * hub could not be reached - so show them as they now are.
 */
function reloadPage () {
  window.location.reload()
}

/**
 * @param {HTMLElement} item
 * @returns {number} Its vertical middle, in pixels
 */
function middleOf (item) {
  const box = item.getBoundingClientRect()

  return box.top + box.height / 2
}

class PinReorder {
  #list
  #status
  #layout
  #showPinsAsSaved
  #press = null
  #drag = null
  #suppressClick = false

  /**
   * @param {HTMLElement} list - Carries `data-reorder-list`
   * @param {() => void} showPinsAsSaved - For a move that was not kept
   */
  constructor (list, showPinsAsSaved) {
    this.#list = list
    this.#showPinsAsSaved = showPinsAsSaved
    this.#status = list.parentElement.querySelector('[data-reorder-status]')
    this.#layout = list.closest('.app-layout') ?? document.body
  }

  attach () {
    this.#list.addEventListener('pointerdown', event => this.#onPointerDown(event))
    // No native link dragging in the list, so only the guide itself moves.
    this.#list.addEventListener('dragstart', event => event.preventDefault())
    this.#list.addEventListener('click', event => this.#onClick(event), true)
    // Capture, so the Esc that cancels a drag does nothing else.
    document.addEventListener('keydown', event => this.#onKey(event), true)
  }

  #items () {
    return Array.from(this.#list.children)
  }

  // Only a guide's link (data-reorder-handle) starts a drag, not its "…" menu.
  #onPointerDown (event) {
    const handle = event.target.closest('[data-reorder-handle]')
    const item = handle?.closest('[data-reorder-id]')

    if (event.button === 0 && item?.parentElement === this.#list) {
      this.#press = { item, x: event.clientX, y: event.clientY }
      document.addEventListener('pointermove', this.#onPointerMove)
      document.addEventListener('pointerup', this.#onPointerUp)
      document.addEventListener('pointercancel', this.#onPointerCancel)
    }
  }

  #onPointerMove = (event) => {
    if (!this.#drag) {
      if (Math.hypot(event.clientX - this.#press.x, event.clientY - this.#press.y) < DRAG_THRESHOLD) {
        return
      }
      this.#startDrag()
    }
    this.#showDropBar(event.clientY)
  }

  #onPointerUp = () => {
    this.#stopListening()
    if (this.#drag) {
      this.#drop()
      // The click that may follow a drag mustn't open the guide.
      this.#suppressClick = true
      window.setTimeout(() => { this.#suppressClick = false }, 0)
    }
  }

  #onPointerCancel = () => {
    this.#stopListening()
    if (this.#drag) {
      this.#endDrag()
    }
  }

  #onClick (event) {
    if (this.#suppressClick) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  #onKey (event) {
    if (event.key === 'Escape' && this.#drag) {
      event.stopPropagation()
      this.#stopListening()
      this.#endDrag()
    }
  }

  #stopListening () {
    this.#press = null
    document.removeEventListener('pointermove', this.#onPointerMove)
    document.removeEventListener('pointerup', this.#onPointerUp)
    document.removeEventListener('pointercancel', this.#onPointerCancel)
  }

  #startDrag () {
    const startIndex = this.#items().indexOf(this.#press.item)

    this.#drag = { item: this.#press.item, startIndex, index: startIndex }
    this.#drag.item.classList.add(DRAGGING)
    this.#layout.classList.add(REORDERING)
    window.getSelection().removeAllRanges()
  }

  #others () {
    return this.#items().filter(item => item !== this.#drag.item)
  }

  #clearDropBar () {
    this.#items().forEach(item => item.classList.remove(DROP_BEFORE, DROP_AFTER))
  }

  #showDropBar (clientY) {
    const others = this.#others()
    const index = dropIndex(others.map(middleOf), clientY)

    this.#clearDropBar()
    this.#drag.index = index
    if (index === this.#drag.startIndex) {
      return
    }
    if (index < others.length) {
      others[index].classList.add(DROP_BEFORE)
    } else {
      others.at(-1).classList.add(DROP_AFTER)
    }
  }

  #endDrag () {
    this.#clearDropBar()
    this.#drag.item.classList.remove(DRAGGING)
    this.#layout.classList.remove(REORDERING)
    this.#drag = null
  }

  #drop () {
    const { item, startIndex, index } = this.#drag
    const others = this.#others()

    this.#endDrag()
    if (index === startIndex) {
      return
    }
    this.#list.insertBefore(item, others[index] ?? null)
    this.#refreshMenus()
    this.#save(item.dataset.reorderId, startIndex, index).catch(this.#showPinsAsSaved)
    if (this.#status) {
      this.#status.textContent = movedMessage(item.dataset.reorderLabel, index, others.length + 1)
    }
  }

  // Keep each guide's "…" menu sending where the guide now is.
  #refreshMenus () {
    const items = this.#items()

    items.forEach((item, position) => {
      item.querySelectorAll('input[name="position"], input[name="from"]').forEach(input => { input.value = String(position) })
      item.querySelectorAll('[data-reorder-move]').forEach(form => {
        const target = moveTarget(position, Number(form.dataset.reorderMove), items.length)

        form.hidden = target === null
        form.querySelector('input[name="to"]').value = String(target ?? position)
      })
    })
  }

  async #save (guideId, from, to) {
    const body = new URLSearchParams({ guideId, from: String(from), to: String(to) })
    const response = await window.fetch(this.#list.dataset.reorderList, { method: 'POST', body })

    if (response.status !== MOVE_KEPT) {
      this.#showPinsAsSaved()
    }
  }
}

/**
 * Lets the user drag their pinned guides into a new order, if the page lists
 * any.
 *
 * @param {Object} [options]
 * @param {() => void} [options.showPinsAsSaved] - For a move that was not
 *   kept; reloads the page unless given
 * @returns {void}
 */
function initPinReorder ({ showPinsAsSaved = reloadPage } = {}) {
  document.querySelectorAll('[data-reorder-list]').forEach(list => new PinReorder(list, showPinsAsSaved).attach())
}

export { dropIndex, initPinReorder, movedMessage, moveTarget }
