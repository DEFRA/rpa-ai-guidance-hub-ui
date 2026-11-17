// @vitest-environment jsdom
import { holdFocus, isFindShortcut, placeMatches, sameWords, shortcutLabel, steppedMatch } from '../../../../src/client/javascripts/guide-search.js'

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
