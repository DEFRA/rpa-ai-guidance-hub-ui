// @vitest-environment jsdom
import { dropIndex, initPinReorder, movedMessage, moveTarget } from '../../../../src/client/javascripts/side-nav-reorder.js'

describe('dropIndex', () => {
  const MIDDLES = [110, 150, 190]

  test.each([
    [100, 0],
    [130, 1],
    [170, 2]
  ])('lands a guide dropped at %s pixels before the first of the others whose middle is below it, at %s', (clientY, index) => {
    expect(dropIndex(MIDDLES, clientY)).toBe(index)
  })

  test('lands a guide dropped below every other at the end', () => {
    expect(dropIndex(MIDDLES, 250)).toBe(3)
  })
})

describe('moveTarget', () => {
  test('moves a guide up or down by one', () => {
    expect(moveTarget(1, -1, 3)).toBe(0)
    expect(moveTarget(1, 1, 3)).toBe(2)
  })

  test('has nowhere to move the first guide up, or the last down', () => {
    expect(moveTarget(0, -1, 3)).toBeNull()
    expect(moveTarget(2, 1, 3)).toBeNull()
  })
})

describe('movedMessage', () => {
  test('tells a screen reader where a dragged guide now is, counting from one', () => {
    expect(movedMessage('Closing a case', 0, 3)).toBe('Moved Closing a case to position 1 of 3.')
  })
})

describe('dragging a pinned guide', () => {
  // Each guide's row, 40 pixels high, the first's top at 100: their middles are
  // at 120, 160 and 200.
  const ROW_HEIGHT = 40
  const FIRST_TOP = 100
  const PINS = [['a', 'Alpha'], ['b', 'Bravo'], ['c', 'Charlie']]

  let showPinsAsSaved

  /** The side navigation's pinned guides, as `side-nav.njk` makes them. */
  function render () {
    const rows = PINS.map(([id, title], position) => `
      <li class="app-side-nav__row" data-reorder-id="${id}" data-reorder-label="${title}">
        <a class="app-side-nav__link" href="/guides/${id}" draggable="false" data-reorder-handle>${title}</a>
        <form method="post" action="/pin-toggle">
          <input type="hidden" name="guideId" value="${id}">
          <input type="hidden" name="pin" value="false">
          <input type="hidden" name="position" value="${position}">
        </form>
        ${[-1, 1].map((step) => `
          <form method="post" action="/pin-order" data-reorder-move="${step}"${moveTarget(position, step, PINS.length) === null ? ' hidden' : ''}>
            ${PINS.map(([shown]) => `<input type="hidden" name="order" value="${shown}">`).join('')}
            <input type="hidden" name="from" value="${position}">
            <input type="hidden" name="to" value="${position + step}">
          </form>`).join('')}
      </li>`).join('')

    document.body.innerHTML = `
      <div class="app-layout">
        <ul class="app-side-nav__list" data-reorder-list="/pin-order">${rows}</ul>
        <p class="govuk-visually-hidden" role="status" data-reorder-status></p>
      </div>`
    _placeRows()
  }

  // jsdom lays nothing out, so each row says where it is, by its place in the list.
  function _placeRows () {
    document.querySelectorAll('[data-reorder-id]').forEach((row) => {
      row.getBoundingClientRect = () => {
        const index = Array.from(row.parentElement.children).indexOf(row)

        return { top: FIRST_TOP + index * ROW_HEIGHT, height: ROW_HEIGHT }
      }
    })
  }

  function row (id) {
    return document.querySelector(`[data-reorder-id="${id}"]`)
  }

  function order () {
    return Array.from(document.querySelectorAll('[data-reorder-id]')).map((item) => item.dataset.reorderId)
  }

  function pointer (target, type, clientY) {
    target.dispatchEvent(new window.PointerEvent(type, { bubbles: true, button: 0, clientX: 10, clientY }))
  }

  /** Press on a guide's link, move to `clientY`, and let go there. */
  function drag (id, clientY) {
    const handle = row(id).querySelector('[data-reorder-handle]')
    const startY = row(id).getBoundingClientRect().top + ROW_HEIGHT / 2

    pointer(handle, 'pointerdown', startY)
    pointer(document, 'pointermove', clientY)
    pointer(document, 'pointerup', clientY)
  }

  function sent (call) {
    const [url, { method, body }] = call

    return { url, method, order: body.getAll('order'), from: body.get('from'), to: body.get('to') }
  }

  beforeEach(() => {
    render()
    showPinsAsSaved = vi.fn()
    window.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 })
    initPinReorder({ showPinsAsSaved })
  })

  test('moves the guide to where it is let go, and saves the move', async () => {
    drag('a', 180)

    expect(order()).toEqual(['b', 'a', 'c'])
    await vi.waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(1))
    expect(sent(window.fetch.mock.calls[0])).toEqual({ url: '/pin-order', method: 'POST', order: ['a', 'b', 'c'], from: '0', to: '1' })
  })

  test('saves one move at a time, in the order they were made, so none overtakes another', async () => {
    let answerFirst
    window.fetch.mockImplementationOnce(() => new Promise((resolve) => { answerFirst = resolve }))

    drag('a', 180)
    drag('c', 90)

    expect(order()).toEqual(['c', 'b', 'a'])
    await vi.waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(window.fetch).toHaveBeenCalledTimes(1)

    answerFirst({ ok: true, status: 204 })

    await vi.waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(2))
    expect(sent(window.fetch.mock.calls[1])).toEqual(expect.objectContaining({ order: ['b', 'a', 'c'], from: '2', to: '0' }))
  })

  test('tells a screen reader where the guide now is', () => {
    drag('c', 90)

    expect(document.querySelector('[data-reorder-status]').textContent).toBe('Moved Charlie to position 1 of 3.')
  })

  test('brings each guide\'s menu up to date with where it now is', () => {
    drag('a', 220)

    expect(order()).toEqual(['b', 'c', 'a'])
    const alpha = row('a')
    expect(alpha.querySelector('input[name="position"]').value).toBe('2')
    expect(alpha.querySelector('[data-reorder-move="1"]').hidden).toBe(true)
    expect(alpha.querySelector('[data-reorder-move="-1"]').hidden).toBe(false)
    expect(alpha.querySelector('[data-reorder-move="-1"] input[name="to"]').value).toBe('1')
    const orders = Array.from(document.querySelectorAll('[data-reorder-move]'))
      .map((form) => Array.from(form.querySelectorAll('input[name="order"]')).map((input) => input.value))
    expect(new Set(orders.map(String))).toEqual(new Set(['b,c,a']))
    expect(row('b').querySelector('[data-reorder-move="-1"]').hidden).toBe(true)
  })

  test('brings the page\'s other ways to unpin a guide up to date with where it now is', () => {
    const unpinForm = (classes) => `
      <form class="${classes}" method="post" action="/pin-toggle">
        <input type="hidden" name="guideId" value="a">
        <input type="hidden" name="pin" value="false">
        <input type="hidden" name="position" value="0">
      </form>`
    document.body.insertAdjacentHTML('beforeend', `<main>${unpinForm('app-pin-toggle')}${unpinForm('app-pin-form')}</main>`)

    drag('a', 220)

    const positions = Array.from(document.querySelectorAll('main input[name="position"]')).map((input) => input.value)
    expect(positions).toEqual(['2', '2'])
  })

  test('is not a drag until the pointer has moved a few pixels, so a click still opens the guide', () => {
    const handle = row('a').querySelector('[data-reorder-handle]')

    pointer(handle, 'pointerdown', 120)
    pointer(document, 'pointermove', 122)
    pointer(document, 'pointerup', 122)
    const click = new window.MouseEvent('click', { bubbles: true, cancelable: true })
    handle.dispatchEvent(click)

    expect(order()).toEqual(['a', 'b', 'c'])
    expect(window.fetch).not.toHaveBeenCalled()
    expect(click.defaultPrevented).toBe(false)
  })

  test('stops the click that ends a drag from opening the guide', () => {
    drag('a', 180)
    const click = new window.MouseEvent('click', { bubbles: true, cancelable: true })
    row('a').querySelector('[data-reorder-handle]').dispatchEvent(click)

    expect(click.defaultPrevented).toBe(true)
  })

  test('is cancelled by Esc, leaving the guides as they were', () => {
    const handle = row('a').querySelector('[data-reorder-handle]')

    pointer(handle, 'pointerdown', 120)
    pointer(document, 'pointermove', 180)
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    pointer(document, 'pointerup', 180)

    expect(order()).toEqual(['a', 'b', 'c'])
    expect(window.fetch).not.toHaveBeenCalled()
  })

  test('stops the click that ends a drag cancelled by Esc from opening the guide', () => {
    const handle = row('a').querySelector('[data-reorder-handle]')

    pointer(handle, 'pointerdown', 120)
    pointer(document, 'pointermove', 180)
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    pointer(document, 'pointermove', 200)
    pointer(document, 'pointerup', 200)
    const click = new window.MouseEvent('click', { bubbles: true, cancelable: true })
    handle.dispatchEvent(click)

    expect(click.defaultPrevented).toBe(true)
    expect(row('a').classList).not.toContain('app-side-nav__reorder--dragging')
    expect(window.fetch).not.toHaveBeenCalled()
  })

  test('saves nothing when the guide is let go where it was', () => {
    drag('b', 165)

    expect(order()).toEqual(['a', 'b', 'c'])
    expect(window.fetch).not.toHaveBeenCalled()
  })

  test.each([
    ['refuses the move', () => window.fetch.mockResolvedValue({ ok: false, status: 409 })],
    ['sends the user to sign in again, whose page answers 200', () => window.fetch.mockResolvedValue({ ok: true, status: 200, redirected: true })],
    ['cannot be reached', () => window.fetch.mockRejectedValue(new TypeError('Failed to fetch'))]
  ])('shows the pins as saved when the hub %s', async (_name, answer) => {
    answer()

    drag('a', 180)

    await vi.waitFor(() => expect(showPinsAsSaved).toHaveBeenCalledTimes(1))
  })
})
