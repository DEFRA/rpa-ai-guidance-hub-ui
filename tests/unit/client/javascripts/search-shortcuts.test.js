// @vitest-environment jsdom
import { initSearchAllGuides, isShortcut, shortcutLabel, showShortcut } from '../../../../src/client/javascripts/search-shortcuts.js'
import { initSideNavDrawer } from '../../../../src/client/javascripts/side-nav-drawer.js'

// The script listens on the document, which outlives each test: take off
// what each test added, so one test's page does not answer another's keys.
const listenOnDocument = document.addEventListener.bind(document)
let documentListeners

beforeEach(() => {
  documentListeners = []
  vi.spyOn(document, 'addEventListener').mockImplementation((...listener) => {
    documentListeners.push(listener)
    listenOnDocument(...listener)
  })
})

afterEach(() => {
  documentListeners.forEach(listener => document.removeEventListener(...listener))
  vi.restoreAllMocks()
})

describe('isShortcut', () => {
  test.each([
    [{ key: 'k', ctrlKey: true }, true],
    [{ key: 'K', metaKey: true }, true],
    [{ key: 'k', ctrlKey: true, altKey: true }, false],
    [{ key: 'K', ctrlKey: true, shiftKey: true }, false],
    [{ key: 'k' }, false],
    [{ key: 'f', ctrlKey: true }, false]
  ])('takes %o as Ctrl+K: %s, leaving Alt and Shift with it to the browser', (event, expected) => {
    expect(isShortcut({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...event }, 'k')).toBe(expected)
  })
})

describe('shortcutLabel', () => {
  test.each([
    ['MacIntel', 'f', '⌘ F'],
    ['iPhone', 'k', '⌘ K'],
    ['iPad', 'f', '⌘ F'],
    ['Win32', 'f', 'Ctrl F'],
    ['Linux x86_64', 'k', 'Ctrl K']
  ])('shows the shortcut on %s with %s as %s', (platform, key, label) => {
    expect(shortcutLabel(platform, key)).toBe(label)
  })
})

describe('showShortcut', () => {
  function shownIn (value) {
    document.body.innerHTML = `<input name="q" value="${value}">`
    const input = document.querySelector('input')

    showShortcut(input, 'k')

    return { input, hint: input.nextElementSibling }
  }

  test('shows the shortcut in an empty box, as a screen reader is told it by the box instead', () => {
    const { input, hint } = shownIn('')

    expect(input).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K')
    // jsdom's platform is none of Apple's.
    expect(hint).toHaveTextContent('Ctrl K')
    expect(hint).toHaveAttribute('aria-hidden', 'true')
    expect(hint).toBeVisible()
  })

  test('hides it while the box holds words', () => {
    const { input, hint } = shownIn('pay')

    expect(hint).not.toBeVisible()
    input.value = ''
    input.dispatchEvent(new window.Event('input'))
    expect(hint).toBeVisible()
  })
})

describe('Ctrl+K', () => {
  function pressCtrlK () {
    const event = new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })

    document.body.dispatchEvent(event)

    return event
  }

  test.each([
    ['the hub\'s search box, on the hub', 'hub-search'],
    ['the side navigation\'s search box, on any other page', 'side-nav-search']
  ])('comes to %s, its words selected, instead of the browser\'s own search, and is named in it', (_, id) => {
    document.body.innerHTML = `<input id="${id}" name="q" value="claim rules">`
    initSearchAllGuides()
    const input = document.getElementById(id)

    const event = pressCtrlK()

    expect(input).toHaveFocus()
    expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe('claim rules')
    expect(event).toHaveProperty('defaultPrevented', true)
    expect(input).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K')
    expect(input.nextElementSibling).toHaveTextContent('Ctrl K')
  })

  test('comes to the side navigation\'s search box, not to a guide\'s heading called "Hub search"', () => {
    document.body.innerHTML = '<input id="side-nav-search" name="q"><h2 id="hub-search">Hub search</h2>'
    initSearchAllGuides()

    pressCtrlK()

    expect(document.querySelector('input')).toHaveFocus()
  })

  test('is left to the browser when only a guide\'s heading has a box\'s id, as with the side navigation folded', () => {
    document.body.innerHTML = '<h2 id="side-nav-search">Side nav search</h2>'
    initSearchAllGuides()

    expect(pressCtrlK()).toHaveProperty('defaultPrevented', false)
  })

  test('is left to the browser on a page with no box that searches all guides, as with the side navigation folded', () => {
    document.body.innerHTML = '<form data-guide-search><input name="q"></form>'
    initSearchAllGuides()

    expect(pressCtrlK()).toHaveProperty('defaultPrevented', false)
  })

  describe('with the side navigation a drawer', () => {
    /**
     * A page whose side navigation is a drawer on a narrow window, the window
     * as narrow as given.
     */
    function drawerPage (narrow) {
      window.matchMedia = vi.fn(() => ({ matches: narrow, addEventListener: () => {} }))
      document.body.innerHTML = `
        <div class="app-layout" data-side-nav-drawer>
          <div class="app-layout__nav">
            <nav aria-label="Guidance hub">
              <a href="/hub">Guidance hub</a>
              <input id="side-nav-search" name="q">
            </nav>
          </div>
          <div class="app-layout__main">
            <button type="submit" data-side-nav-toolbar-toggle>
              <span data-side-nav-toolbar-label>Collapse navigation</span>
            </button>
          </div>
        </div>`
      initSideNavDrawer()
      initSearchAllGuides()
    }

    const toggle = () => document.querySelector('[data-side-nav-toolbar-toggle]')

    afterEach(() => {
      delete window.matchMedia
    })

    test('opens the closed drawer on a narrow window, then comes to its search box, as the closed drawer is hidden', () => {
      drawerPage(true)

      pressCtrlK()

      expect(toggle()).toHaveAttribute('aria-expanded', 'true')
      expect(document.getElementById('side-nav-search')).toHaveFocus()
    })

    test('does not press the toolbar\'s button on a wide window, where it would fold the navigation', () => {
      drawerPage(false)
      const pressed = vi.fn()
      toggle().addEventListener('click', pressed)

      pressCtrlK()

      expect(pressed).not.toHaveBeenCalled()
      expect(document.getElementById('side-nav-search')).toHaveFocus()
    })
  })
})
