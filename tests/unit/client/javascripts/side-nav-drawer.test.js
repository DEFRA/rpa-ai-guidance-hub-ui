// @vitest-environment jsdom
import { initSideNavDrawer } from '../../../../src/client/javascripts/side-nav-drawer.js'

const OPEN_CLASS = 'app-layout--drawer-open'

/**
 * The window's width, as the script asks for it: narrow or not, and told when
 * that changes.
 *
 * @param {boolean} narrow
 * @returns {{resize: (narrow: boolean) => void}}
 */
function windowThatIs (narrow) {
  const listeners = []
  const query = {
    matches: narrow,
    addEventListener: (_type, listener) => listeners.push(listener)
  }

  window.matchMedia = vi.fn(() => query)

  return {
    resize (nowNarrow) {
      query.matches = nowNarrow
      listeners.forEach((listener) => listener({ matches: nowNarrow }))
    }
  }
}

describe('initSideNavDrawer', () => {
  let submitted

  beforeEach(() => {
    document.body.innerHTML = `
      <form id="side-nav-toggle-form" method="post" action="/side-nav/toggle" hidden></form>
      <div class="app-layout" data-side-nav-drawer>
        <div class="app-layout__nav" id="app:layout:nav">
          <nav aria-label="Guidance hub">
            <form><input type="hidden" name="guideId" value="1"></form>
            <a href="/hub" id="first">Guidance hub</a>
            <button type="submit" form="side-nav-toggle-form" data-side-nav-collapse>Collapse navigation</button>
            <a href="/logout" id="last">Sign out</a>
          </nav>
        </div>
        <div class="app-layout__main">
          <button type="submit" form="side-nav-toggle-form" aria-controls="app:layout:nav" data-side-nav-toolbar-toggle>
            <span data-side-nav-toolbar-label>Collapse navigation</span>
          </button>
          <a href="/guides/1" id="outside">A guide</a>
        </div>
      </div>`
    // jsdom cannot send a form; whether it was asked to is what matters here.
    submitted = vi.fn((event) => event.preventDefault())
    document.getElementById('side-nav-toggle-form')
      .addEventListener('submit', submitted)
  })

  afterEach(() => {
    delete window.matchMedia
  })

  const layout = () => document.querySelector('.app-layout')
  const toggle = () => document.querySelector('[data-side-nav-toolbar-toggle]')
  const backdrop = () => document.querySelector('.app-layout__backdrop')
  const press = (element, key) => element.dispatchEvent(
    new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  )

  describe('on a narrow window', () => {
    let width

    beforeEach(() => {
      width = windowThatIs(true)
      initSideNavDrawer()
    })

    test('names the button for opening the navigation, which is closed', () => {
      expect(toggle()).toHaveAccessibleName('Open navigation')
      expect(toggle()).toHaveAttribute('aria-expanded', 'false')
      expect(layout()).not.toHaveClass(OPEN_CLASS)
    })

    test('opens the drawer and moves focus to the first thing in it', () => {
      toggle().click()

      expect(layout()).toHaveClass(OPEN_CLASS)
      expect(toggle()).toHaveAccessibleName('Close navigation')
      expect(toggle()).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById('first')).toHaveFocus()
      expect(submitted).not.toHaveBeenCalled()
    })

    test('closes on the button again, with focus back on it', () => {
      toggle().click()
      toggle().click()

      expect(layout()).not.toHaveClass(OPEN_CLASS)
      expect(toggle()).toHaveAccessibleName('Open navigation')
      expect(toggle()).toHaveAttribute('aria-expanded', 'false')
      expect(toggle()).toHaveFocus()
    })

    test('closes on Escape, with focus back on the button', () => {
      toggle().click()
      press(document.getElementById('last'), 'Escape')

      expect(layout()).not.toHaveClass(OPEN_CLASS)
      expect(toggle()).toHaveFocus()
    })

    test('stays open on Escape that something in it has already used', () => {
      toggle().click()
      document.getElementById('last')
        .addEventListener('keydown', (event) => event.preventDefault())
      press(document.getElementById('last'), 'Escape')

      expect(layout()).toHaveClass(OPEN_CLASS)
    })

    test('stays open on any other key', () => {
      toggle().click()
      press(document.getElementById('last'), 'ArrowDown')

      expect(layout()).toHaveClass(OPEN_CLASS)
    })

    test('closes on a click on the page behind it, with focus back on the button', () => {
      toggle().click()
      backdrop().click()

      expect(layout()).not.toHaveClass(OPEN_CLASS)
      expect(toggle()).toHaveFocus()
    })

    test('covers the page behind it once, however often it is opened', () => {
      toggle().click()
      toggle().click()
      toggle().click()

      expect(document.querySelectorAll('.app-layout__backdrop')).toHaveLength(1)
    })

    test('closes on its own collapse button, without folding the navigation away', () => {
      toggle().click()
      document.querySelector('[data-side-nav-collapse]').click()

      expect(layout()).not.toHaveClass(OPEN_CLASS)
      expect(toggle()).toHaveFocus()
      expect(submitted).not.toHaveBeenCalled()
    })

    test('closes when focus moves out of it, and leaves focus where it went', () => {
      toggle().click()
      document.getElementById('outside').focus()

      expect(layout()).not.toHaveClass(OPEN_CLASS)
      expect(document.getElementById('outside')).toHaveFocus()
    })

    test('stays open while focus moves within it', () => {
      toggle().click()
      document.getElementById('last').focus()

      expect(layout()).toHaveClass(OPEN_CLASS)
    })

    test('closes when the window is widened, and the button folds the navigation again', () => {
      toggle().click()
      width.resize(false)

      expect(layout()).not.toHaveClass(OPEN_CLASS)
      expect(toggle()).toHaveAccessibleName('Collapse navigation')
      expect(toggle()).not.toHaveAttribute('aria-expanded')

      toggle().click()

      expect(submitted).toHaveBeenCalledTimes(1)
      expect(layout()).not.toHaveClass(OPEN_CLASS)
    })
  })

  describe('on a wide window', () => {
    let width

    beforeEach(() => {
      width = windowThatIs(false)
      initSideNavDrawer()
    })

    test('leaves the button folding the navigation away, as the page says', () => {
      toggle().click()

      expect(toggle()).toHaveAccessibleName('Collapse navigation')
      expect(toggle()).not.toHaveAttribute('aria-expanded')
      expect(submitted).toHaveBeenCalledTimes(1)
      expect(layout()).not.toHaveClass(OPEN_CLASS)
    })

    test('leaves the navigation\'s own collapse button folding it away', () => {
      document.querySelector('[data-side-nav-collapse]').click()

      expect(submitted).toHaveBeenCalledTimes(1)
    })

    test('makes the button open the drawer once the window is narrowed', () => {
      width.resize(true)

      expect(toggle()).toHaveAccessibleName('Open navigation')
      expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    })
  })

  test('does nothing on a page without the navigation', () => {
    document.body.innerHTML = '<main></main>'
    window.matchMedia = vi.fn()

    expect(() => initSideNavDrawer()).not.toThrow()
    expect(window.matchMedia).not.toHaveBeenCalled()
  })
})
