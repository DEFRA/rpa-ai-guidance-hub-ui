/**
 * Dragging the side navigation's lists into a new order - the pins (guides
 * and sections of guides), the cases, and the guides within a case - as the
 * prototype does
 * (rpa-ai-guidance-hub-prototype: app/assets/javascripts/side-nav.js). A
 * pointer drag on an item's handle (past a few pixels, so a click still opens
 * it) moves the item; a bar shows where it will land, and Esc cancels. The
 * move is sent to the list's `data-reorder-list` address with the order the
 * list showed, where the item moved `from` and `to`, and the list's own
 * `data-reorder-fields`; a screen reader is told where the item now is. Move
 * up and Move down in each item's "…" menu do the same without dragging.
 *
 * A list inside an item drags its own items: each list moves only its own,
 * and keeps only their own menus up to date. A list whose items' positions are
 * also sent by forms elsewhere on the page names those forms' action in
 * `data-reorder-elsewhere`, as the pins do for unpinning; each such form names
 * the item it follows in `data-reorder-follows`.
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
 * @param {number[]} middles - The vertical middle of each of the other items,
 *   top to bottom, in pixels
 * @param {number} clientY - Where the dragged item is, in pixels
 * @returns {number} Where it lands among the others: before the first whose
 *   middle is below it, or after them all
 */
function dropIndex (middles, clientY) {
  const index = middles.findIndex(middle => clientY < middle)

  return index === -1 ? middles.length : index
}

/**
 * @param {number} position - The item's, counting from 0
 * @param {number} step - -1 to move it up, 1 to move it down
 * @param {number} count - How many items there are
 * @returns {number|null} Where the step takes it, or null when it has no
 *   neighbour that way
 */
function moveTarget (position, step, count) {
  const target = position + step

  return target >= 0 && target < count ? target : null
}

/**
 * @param {string} label - The item's name, as its list shows it
 * @param {number} position - Where it now is, counting from 0
 * @param {number} count - How many items there are
 * @returns {string} What a screen reader is told once it is dragged
 */
function movedMessage (label, position, count) {
  return `Moved ${label} to position ${position + 1} of ${count}.`
}

/**
 * The move was not kept - the list changed since the page showed it, or the
 * hub could not be reached - so show it as it now is.
 */
function reloadPage () {
  window.location.reload()
}

/**
 * @param {string|undefined} action - The forms', as the list names it
 * @param {string} id - An item's
 * @returns {HTMLFormElement[]} The page's forms with that action that follow
 *   the item, sending its position; none without an action
 */
function formsElsewhere (action, id) {
  if (!action) {
    return []
  }

  return Array.from(document.querySelectorAll(`form[action="${action}"]`))
    .filter(form => form.dataset.reorderFollows === id)
}

/**
 * @param {HTMLElement} item
 * @returns {number} Its vertical middle, in pixels
 */
function middleOf (item) {
  const box = item.getBoundingClientRect()

  return box.top + box.height / 2
}

class Reorder {
  #list
  #status
  #layout
  #showAsSaved
  // The moves being saved, one after another, so none overtakes another.
  #saving = Promise.resolve()
  #press = null
  #drag = null
  #suppressClick = false

  /**
   * @param {HTMLElement} list - Carries `data-reorder-list`
   * @param {() => void} showAsSaved - For a move that was not kept
   */
  constructor (list, showAsSaved) {
    this.#list = list
    this.#showAsSaved = showAsSaved
    this.#status = list.parentElement.querySelector(':scope > [data-reorder-status]')
    this.#layout = list.closest('.app-layout') ?? document.body
  }

  attach () {
    this.#list.addEventListener('pointerdown', event => this.#onPointerDown(event))
    // No native link dragging in the list, so only the item itself moves.
    this.#list.addEventListener('dragstart', event => event.preventDefault())
    this.#list.addEventListener('click', event => this.#onClick(event), true)
    // Capture, so the Esc that cancels a drag does nothing else.
    document.addEventListener('keydown', event => this.#onKey(event), true)
  }

  #items () {
    return Array.from(this.#list.children)
  }

  // The items' ids, as the list now shows them.
  #order () {
    return this.#items().map(item => item.dataset.reorderId)
  }

  // Only an item's handle starts a drag, not its "…" menu; and only this
  // list's own items move here, not those of a list inside one.
  #onPointerDown (event) {
    const handle = event.target.closest('[data-reorder-handle]')
    const item = handle?.closest('[data-reorder-id]')

    if (event.button === 0 && item?.parentElement === this.#list) {
      this.#press = { item, x: event.clientX, y: event.clientY, cancelled: false }
      document.addEventListener('pointermove', this.#onPointerMove)
      document.addEventListener('pointerup', this.#onPointerUp)
      document.addEventListener('pointercancel', this.#onPointerCancel)
    }
  }

  #onPointerMove = (event) => {
    if (this.#press.cancelled) {
      return
    }
    if (!this.#drag) {
      if (Math.hypot(event.clientX - this.#press.x, event.clientY - this.#press.y) < DRAG_THRESHOLD) {
        return
      }
      this.#startDrag()
    }
    this.#showDropBar(event.clientY)
  }

  #onPointerUp = () => {
    const dragged = this.#drag !== null || this.#press.cancelled

    this.#stopListening()
    if (this.#drag) {
      this.#drop()
    }
    if (dragged) {
      // The click that may follow a drag, even a cancelled one, mustn't open
      // the item.
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
      // The press goes on until the pointer is let go (#onPointerUp).
      this.#press.cancelled = true
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
    const shown = this.#order()
    this.#list.insertBefore(item, others[index] ?? null)
    this.#refreshPositions()
    this.#saving = this.#saving
      .then(() => this.#save(shown, startIndex, index))
      .catch(this.#showAsSaved)
    if (this.#status) {
      this.#status.textContent = movedMessage(item.dataset.reorderLabel, index, others.length + 1)
    }
  }

  // Keep every form that acts on an item sending where the item now is: its own
  // "…" menu, not the menus of a list inside it, and the forms elsewhere that
  // the list names that follow it (for a pin, the hub's star, a guide page's
  // Unpin guide and a heading's star); and each move sending the order the
  // list now shows.
  #refreshPositions () {
    const items = this.#items()
    const order = this.#order()

    items.forEach((item, position) => {
      const own = selector => Array.from(item.querySelectorAll(selector))
        .filter(element => element.closest('[data-reorder-id]') === item)

      formsElsewhere(this.#list.dataset.reorderElsewhere, item.dataset.reorderId)
        .forEach(form => { form.elements.position.value = String(position) })
      own('input[name="from"]').forEach(input => { input.value = String(position) })
      own('[data-reorder-move]').forEach(form => {
        const target = moveTarget(position, Number(form.dataset.reorderMove), items.length)

        form.querySelectorAll('input[name="order"]').forEach((input, at) => { input.value = order[at] })
        form.hidden = target === null
        form.querySelector('input[name="to"]').value = String(target ?? position)
      })
    })
  }

  /**
   * @param {string[]} shown - The items' ids as they were before the move,
   *   which the hub checks they still are
   * @param {number} from
   * @param {number} to
   */
  async #save (shown, from, to) {
    const fields = Object.entries(JSON.parse(this.#list.dataset.reorderFields ?? '{}'))
    const body = new URLSearchParams([...fields, ...shown.map(id => ['order', id]), ['from', String(from)], ['to', String(to)]])
    const response = await window.fetch(this.#list.dataset.reorderList, { method: 'POST', body })

    if (response.status !== MOVE_KEPT) {
      this.#showAsSaved()
    }
  }
}

/**
 * Lets the user drag the side navigation's lists into a new order, if the
 * page has any.
 *
 * @param {Object} [options]
 * @param {() => void} [options.showAsSaved] - For a move that was not kept;
 *   reloads the page unless given
 * @returns {void}
 */
function initReorder ({ showAsSaved = reloadPage } = {}) {
  document.querySelectorAll('[data-reorder-list]').forEach(list => new Reorder(list, showAsSaved).attach())
}

export { dropIndex, initReorder, movedMessage, moveTarget }
