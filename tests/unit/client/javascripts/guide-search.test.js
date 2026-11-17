// @vitest-environment jsdom
import { holdFocus, initGuideSearch, isFindShortcut, placeMatches, sameWords, shortcutLabel, steppedMatch } from '../../../../src/client/javascripts/guide-search.js'

describe('steppedMatch', () => {
  test.each([
    [2, 5, false, 3],
    [5, 5, false, 1],
    [2, 5, true, 1],
    [1, 5, true, 5]
  ])('from match %i of %i, back %s, steps to %i, round at either end', (current, total, back, stepped) => {
    expect(steppedMatch(current, total, back)).toBe(stepped)
  })
})

describe('isFindShortcut', () => {
  test.each([
    [{ key: 'f', ctrlKey: true }, true],
    [{ key: 'F', metaKey: true }, true],
    [{ key: 'f', ctrlKey: true, altKey: true }, false],
    [{ key: 'f' }, false],
    [{ key: 'g', ctrlKey: true }, false]
  ])('takes %o as the find shortcut: %s', (event, expected) => {
    expect(isFindShortcut({ ctrlKey: false, metaKey: false, altKey: false, ...event })).toBe(expected)
  })
})

describe('shortcutLabel', () => {
  test.each([
    ['MacIntel', '⌘ F'],
    ['iPhone', '⌘ F'],
    ['Win32', 'Ctrl F'],
    ['Linux x86_64', 'Ctrl F']
  ])('shows the shortcut on %s as %s', (platform, label) => {
    expect(shortcutLabel(platform)).toBe(label)
  })
})

describe('holdFocus', () => {
  function page (readyState) {
    const listeners = []

    return {
      document: { readyState },
      addEventListener: (type, listener, options) => listeners.push({ type, listener, options }),
      setTimeout: (callback) => callback(),
      load: () => listeners.filter(({ type }) => type === 'load').forEach(({ listener }) => listener())
    }
  }

  test('puts the focus in the search box of a page loaded with a search, without scrolling', () => {
    const input = { focus: vi.fn() }

    holdFocus(input, page('complete'))

    expect(input.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  test('puts it back once the page has loaded, after whatever took it meanwhile', () => {
    const input = { focus: vi.fn() }
    const loading = page('interactive')

    holdFocus(input, loading)
    input.focus.mockClear()
    loading.load()

    expect(input.focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})

describe('sameWords', () => {
  test('takes words in another case, or with other spaces, as the same', () => {
    expect(sameWords(' Single  PAYMENT ', 'single payment')).toBe(true)
  })

  test('takes other words as a new search', () => {
    expect(sameWords('single pay', 'single payment')).toBe(false)
  })
})

describe('placeMatches', () => {
  // A guide's page as the hub draws it: its title, an Introduction with a
  // made-up title, and a page whose heading is "claims-1" on the page. Its
  // heading in a quote does not start a section; its controls are not its text.
  const PAGE = `
    <h1 class="app-guide-title">Overpayments</h1>
    <div data-guide-page="1" data-guide-page-section="">
      <h2 class="app-guide-heading-1">Introduction</h2>
      <div class="app-guide-markdown"><p>Pay on time.</p></div>
    </div>
    <div data-guide-page="2" data-guide-page-section="claims-1" hidden="until-found">
      <h2 class="app-guide-heading-1" id="claims-1">Claims</h2>
      <div class="app-guide-markdown">
        <p>Pay <strong>the</strong> claim.</p>
        <blockquote><h3 id="note">Note</h3><p>Pay late.</p></blockquote>
        <div class="app-guide-heading-row">
          <h3 id="checks">Checks</h3>
          <span class="app-guide-section-pin"><span class="govuk-visually-hidden">Pin section: Checks</span></span>
        </div>
        <p>Pay twice.</p>
      </div>
    </div>`
  const STARTS = new Set(['claims-1', 'checks'])

  beforeEach(() => {
    document.body.innerHTML = PAGE
    vi.spyOn(window.console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('finds each match where the page shows it: in the title, an Introduction, and a section, across bold', () => {
    const placed = placeMatches([
      { anchor: null, start: 4, end: 7, text: 'pay' },
      { anchor: '', start: 0, end: 3, text: 'Pay' },
      { anchor: 'claims-1', start: 11, end: 20, text: 'the claim' },
      { anchor: 'checks', start: 7, end: 10, text: 'Pay' }
    ], STARTS)

    expect(placed.map(range => range.toString())).toEqual(['pay', 'Pay', 'the claim', 'Pay'])
    expect(placed[2].startContainer.parentElement.closest('p')).toHaveTextContent('Pay the claim.')
    expect(placed[3].startContainer.parentElement).toHaveTextContent('Pay twice.')
  })

  test('reads a heading that starts no section, as in a quote, as part of the section before it', () => {
    const [placed] = placeMatches([{ anchor: 'claims-1', start: 27, end: 30, text: 'Pay' }], STARTS)

    expect(placed.startContainer.parentElement).toHaveTextContent('Pay late.')
  })

  test('does not place a match whose words the page has not got there', () => {
    expect(placeMatches([{ anchor: 'checks', start: 0, end: 3, text: 'Pay' }], STARTS)).toEqual([null])
  })
})

describe('stepping between the matches', () => {
  const MATCHES = [
    { anchor: null, start: 4, end: 7, text: 'pay' },
    { anchor: '', start: 0, end: 3, text: 'Pay' },
    { anchor: 'claims-1', start: 7, end: 10, text: 'Pay' },
    { anchor: 'claims-1', start: 27, end: 30, text: 'Pay' },
    { anchor: 'checks', start: 7, end: 10, text: 'Pay' }
  ]
  // The search form and contents as the server draws them, with the page above.
  const SEARCHED = `
    <div id="guide:contents">
      <form data-guide-search data-guide-search-q="pay"
        data-guide-search-matches='${JSON.stringify(MATCHES)}' data-guide-search-sections='["claims-1","checks"]'>
        <input name="q" value="pay">
        <div data-guide-search-controls hidden>
          <button type="button" data-guide-search-step="previous">Previous</button>
          <button type="button" data-guide-search-step="next">Next</button>
          <span data-guide-search-position></span>
        </div>
      </form>
      <nav><p><a href="#claims-1">Claims</a><span class="app-guide-contents__count" data-guide-search-first="3">2</span></p></nav>
    </div>`
  let painted

  beforeEach(() => {
    painted = new Map()
    vi.stubGlobal('CSS', { highlights: painted })
    vi.stubGlobal('Highlight', class { constructor (...ranges) { this.ranges = ranges } })
    vi.stubGlobal('ResizeObserver', class { observe () {} })
    window.Range.prototype.getBoundingClientRect = () => ({ top: 100, bottom: 120 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.Range.prototype.getBoundingClientRect
  })

  const positionText = () => document.querySelector('[data-guide-search-position]').textContent
  const currentText = () => painted.get('guide-keyword-current').ranges.map(range => range.toString())

  function searchAt (body) {
    document.body.innerHTML = `${SEARCHED}${body}`
    initGuideSearch()
  }

  test('paints every match, and starts at the first on a page that is shown, saying where the reader is', () => {
    searchAt(placedPage())

    expect(painted.get('guide-keyword-match').ranges).toHaveLength(5)
    expect(positionText()).toBe('Match 1 of 5')
    expect(document.querySelector('[data-guide-search-controls]')).not.toHaveAttribute('hidden')
  })

  test('goes to the next match with Next, and round from the last to the first', () => {
    searchAt(placedPage())
    const next = document.querySelector('[data-guide-search-step="next"]')

    next.click()
    expect(positionText()).toBe('Match 2 of 5')
    for (let step = 0; step < 4; step += 1) {
      next.click()
    }
    expect(positionText()).toBe('Match 1 of 5')
  })

  test('goes to the next match with Enter in the search box, and the one before with Shift+Enter', () => {
    searchAt(placedPage())
    const input = document.querySelector('input[name="q"]')

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(positionText()).toBe('Match 2 of 5')
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }))
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }))
    expect(positionText()).toBe('Match 5 of 5')
  })

  test('goes to the first match under a contents entry when its count is clicked, showing the page that holds it', () => {
    searchAt(placedPage())
    const shown = vi.fn()
    document.querySelector('[data-guide-page="2"]').addEventListener('guide-pages:show', shown)

    document.querySelector('.app-guide-contents__count').click()

    expect(positionText()).toBe('Match 3 of 5')
    expect(currentText()).toEqual(['Pay'])
    expect(shown).toHaveBeenCalled()
  })
})

/** The guide's page that `placeMatches`' tests read. */
function placedPage () {
  return `
    <h1 class="app-guide-title">Overpayments</h1>
    <div data-guide-page="1" data-guide-page-section="">
      <h2 class="app-guide-heading-1">Introduction</h2>
      <div class="app-guide-markdown"><p>Pay on time.</p></div>
    </div>
    <div data-guide-page="2" data-guide-page-section="claims-1" hidden="until-found">
      <h2 class="app-guide-heading-1" id="claims-1">Claims</h2>
      <div class="app-guide-markdown">
        <p>Pay <strong>the</strong> claim.</p>
        <blockquote><h3 id="note">Note</h3><p>Pay late.</p></blockquote>
        <div class="app-guide-heading-row"><h3 id="checks">Checks</h3></div>
        <p>Pay twice.</p>
      </div>
    </div>`
}
