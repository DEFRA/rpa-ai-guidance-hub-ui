// @vitest-environment jsdom
import { dropIndex, initReorder, movedMessage, moveTarget } from '../../../../src/client/javascripts/side-nav-reorder.js'

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
        <form method="post" action="/pin-toggle" data-reorder-follows="${id}">
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
        <ul class="app-side-nav__list" data-reorder-list="/pin-order" data-reorder-elsewhere="/pin-toggle">${rows}</ul>
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))
    initReorder({ showAsSaved: showPinsAsSaved })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
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

  test('brings the page\'s other ways to unpin a pin up to date with where it now is, and no other pin\'s', () => {
    const unpinForm = (classes, follows) => `
      <form class="${classes}" method="post" action="/pin-toggle" data-reorder-follows="${follows}">
        <input type="hidden" name="guideId" value="a">
        <input type="hidden" name="pin" value="false">
        <input type="hidden" name="position" value="0">
      </form>`
    document.body.insertAdjacentHTML('beforeend', `<main>${unpinForm('app-pin-toggle', 'a')}${unpinForm('app-pin-form', 'a')}${unpinForm('app-guide-section-pin', 'a/s1')}</main>`)

    drag('a', 220)

    const positions = Array.from(document.querySelectorAll('main input[name="position"]')).map((input) => input.value)
    expect(positions).toEqual(['2', '2', '0'])
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

describe('dragging a case, or a guide within a case', () => {
  // Each row is 40 pixels high, each list's first at the top of 100, as the
  // pinned guides' are: one list's rows never meet another's.
  const ROW_HEIGHT = 40
  const FIRST_TOP = 100
  const CASES = [['k1', 'Case W1234567', ['g1', 'g2', 'g3']], ['k2', 'Case W7654321', ['g4']]]

  /** The side navigation's case bookmarks, as `side-nav.njk` makes them. */
  function render () {
    const moves = (action, position, count, fields) => [-1, 1].map((step) => `
      <form method="post" action="${action}" data-reorder-move="${step}"${moveTarget(position, step, count) === null ? ' hidden' : ''}>
        ${fields}
        <input type="hidden" name="from" value="${position}">
        <input type="hidden" name="to" value="${position + step}">
      </form>`).join('')
    const cases = CASES.map(([key, name, guides], position) => `
      <li class="app-side-nav__case" data-reorder-id="${key}" data-reorder-label="${name}">
        <div class="app-side-nav__case-name" data-reorder-handle>${name}</div>
        ${moves('/case-bookmarks/order', position, CASES.length, CASES.map(([shown]) => `<input type="hidden" name="order" value="${shown}">`).join(''))}
        <ul class="app-side-nav__sublist" data-reorder-list="/case-bookmarks/guide-order" data-reorder-fields='{"key":"${key}"}'>
          ${guides.map((guide, at) => `
            <li data-reorder-id="${guide}" data-reorder-label="Guide ${guide}">
              <a class="app-side-nav__sublink" href="/guides/${guide}" draggable="false" data-reorder-handle>Guide ${guide}</a>
              ${moves('/case-bookmarks/guide-order', at, guides.length, `<input type="hidden" name="key" value="${key}">${guides.map(shown => `<input type="hidden" name="order" value="${shown}">`).join('')}`)}
            </li>`).join('')}
        </ul>
        <p class="govuk-visually-hidden" role="status" data-reorder-status></p>
      </li>`).join('')

    document.body.innerHTML = `
      <div class="app-layout">
        <details id="side-nav-bookmarks">
          <ul class="app-side-nav__list" data-reorder-list="/case-bookmarks/order">${cases}</ul>
          <p class="govuk-visually-hidden" role="status" data-reorder-status></p>
        </details>
        <main>
          <form method="post" action="/pin-toggle" data-reorder-follows="g1">
            <input type="hidden" name="guideId" value="g1">
            <input type="hidden" name="position" value="0">
          </form>
        </main>
      </div>`
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

  function idsIn (list) {
    return Array.from(list.children).map((item) => item.dataset.reorderId)
  }

  function drag (id, clientY) {
    const handle = row(id).querySelector('[data-reorder-handle]')
    const startY = row(id).getBoundingClientRect().top + ROW_HEIGHT / 2

    handle.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: startY }))
    document.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, button: 0, clientX: 10, clientY }))
    document.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 10, clientY }))
  }

  function sent (call) {
    const [url, { body }] = call

    return { url, fields: Object.fromEntries([...body.keys()].map(name => [name, name === 'order' ? body.getAll(name) : body.get(name)])) }
  }

  beforeEach(() => {
    render()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))
    initReorder({ showAsSaved: vi.fn() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('moves a guide within its case, saving it with the case\'s key and the guides shown', async () => {
    drag('g1', 180)

    expect(idsIn(row('k1').querySelector('ul'))).toEqual(['g2', 'g1', 'g3'])
    expect(idsIn(document.querySelector('[data-reorder-list="/case-bookmarks/order"]'))).toEqual(['k1', 'k2'])
    await vi.waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(1))
    expect(sent(window.fetch.mock.calls[0])).toEqual({
      url: '/case-bookmarks/guide-order',
      fields: { key: 'k1', order: ['g1', 'g2', 'g3'], from: '0', to: '1' }
    })
  })

  test('moves a case with its guides, saving it with the cases shown', async () => {
    drag('k1', 180)

    expect(idsIn(document.querySelector('[data-reorder-list="/case-bookmarks/order"]'))).toEqual(['k2', 'k1'])
    expect(idsIn(row('k1').querySelector('ul'))).toEqual(['g1', 'g2', 'g3'])
    await vi.waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(1))
    expect(sent(window.fetch.mock.calls[0])).toEqual({
      url: '/case-bookmarks/order',
      fields: { order: ['k1', 'k2'], from: '0', to: '1' }
    })
  })

  test('brings a moved case\'s own menu up to date, and not its guides\' menus', () => {
    drag('k1', 180)

    const own = Array.from(row('k1').querySelectorAll(':scope > form input[name="from"]')).map((input) => input.value)
    const guides = Array.from(row('k1').querySelectorAll(':scope ul input[name="from"]')).map((input) => input.value)
    expect(own).toEqual(['1', '1'])
    expect(guides).toEqual(['0', '0', '1', '1', '2', '2'])
  })

  test('leaves the page\'s ways to unpin a guide as they were when the guide moves within a case', () => {
    drag('g1', 220)

    expect(document.querySelector('main input[name="position"]').value).toBe('0')
  })

  test('tells a screen reader where a guide now is, in its own case\'s words', () => {
    drag('g1', 180)

    expect(row('k1').querySelector(':scope > [data-reorder-status]').textContent).toContain('Guide g1')
    expect(document.querySelector('#side-nav-bookmarks > [data-reorder-status]').textContent).toBe('')
  })
})
