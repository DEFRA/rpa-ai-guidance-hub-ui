// @vitest-environment jsdom
import { within } from '@testing-library/dom'

import { holdFocus, initGuideSearch, placeMatches, sameWords, steppedMatch } from '../../../../src/client/javascripts/guide-search.js'

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

describe('steppedMatch', () => {
  test.each([
    [2, 5, false, 3],
    [5, 5, false, 1],
    [2, 5, true, 1],
    [1, 5, true, 5]
  ])('from match %i of %i, back %s, steps to %i, round at either end', (current, total, back, stepped) => {
    expect(steppedMatch(current, total, back)).toBe(stepped)
  })

  test.each([
    [2.5, 5, false, 3],
    [2.5, 5, true, 2],
    [0.5, 5, true, 5],
    [5.5, 5, false, 1]
  ])('from between two matches (%s of %i), back %s, steps to the one on that side, %i', (current, total, back, stepped) => {
    expect(steppedMatch(current, total, back)).toBe(stepped)
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

describe('the find shortcut', () => {
  function pressFind (target) {
    const event = new window.KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true })

    target.dispatchEvent(event)

    return event
  }

  beforeEach(() => {
    document.body.innerHTML = `
      <form data-guide-search><input name="q" value="pay claims"></form>
      <a href="#claims">Claims</a>`
    initGuideSearch()
  })

  test('brings Ctrl+F from anywhere else on the page to the search box, its words selected, instead of the browser\'s find', () => {
    const input = document.querySelector('input[name="q"]')
    const link = document.querySelector('a')
    link.focus()

    const event = pressFind(link)

    expect(input).toHaveFocus()
    expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe('pay claims')
    expect(event).toHaveProperty('defaultPrevented', true)
    expect(input).toHaveAttribute('aria-keyshortcuts', 'Control+F Meta+F')
  })

  test('leaves a second Ctrl+F, pressed with the search box\'s words selected, to the browser\'s own find', () => {
    const input = document.querySelector('input[name="q"]')
    document.querySelector('a').focus()

    pressFind(document.activeElement)

    expect(pressFind(input)).toHaveProperty('defaultPrevented', false)
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
  // A guide's page as the hub draws it: an Introduction with a made-up
  // title, and a page whose heading is "claims-1" on the page. Its
  // heading in a quote does not start a section; its controls are not its text.
  const PAGE = `
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

  test('finds each match where the page shows it: in an Introduction, and in a section, across bold', () => {
    const placed = placeMatches([
      { anchor: '', start: 0, end: 3, text: 'Pay' },
      { anchor: 'claims-1', start: 11, end: 20, text: 'the claim' },
      { anchor: 'checks', start: 7, end: 10, text: 'Pay' }
    ], STARTS)

    expect(placed.map(range => range.toString())).toEqual(['Pay', 'the claim', 'Pay'])
    expect(placed[1].startContainer.parentElement.closest('p')).toHaveTextContent('Pay the claim.')
    expect(placed[2].startContainer.parentElement).toHaveTextContent('Pay twice.')
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
    { anchor: '', start: 0, end: 3, text: 'Pay' },
    { anchor: 'claims-1', start: 7, end: 10, text: 'Pay' },
    { anchor: 'claims-1', start: 27, end: 30, text: 'Pay' },
    { anchor: 'checks', start: 7, end: 10, text: 'Pay' }
  ]
  // The search form and contents as the server draws them, with the page above.
  const searched = (matches = MATCHES) => `
    <div id="guide:contents">
      <form data-guide-search data-guide-search-q="pay"
        data-guide-search-matches='${JSON.stringify(matches)}' data-guide-search-sections='["claims-1","checks"]'>
        <input name="q" value="pay">
        <div data-guide-search-controls hidden>
          <button type="button" data-guide-search-step="previous">Previous</button>
          <button type="button" data-guide-search-step="next">Next</button>
          <span data-guide-search-position></span>
        </div>
      </form>
      <nav><p><a href="#claims-1">Claims</a><span class="app-guide-contents__count" data-guide-search-first="2">2<span class="govuk-visually-hidden"> matches</span></span></p></nav>
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
    window.history.replaceState(null, '', window.location.pathname)
  })

  const positionText = () => document.querySelector('[data-guide-search-position]').textContent
  const currentText = () => painted.get('guide-keyword-current').ranges.map(range => range.toString())

  function searchAt (body, matches) {
    document.body.innerHTML = `${searched(matches)}${body}`
    initGuideSearch()
  }

  test('paints every match, and starts at the first on a page that is shown, saying where the reader is', () => {
    searchAt(placedPage())

    expect(painted.get('guide-keyword-match').ranges).toHaveLength(4)
    expect(positionText()).toBe('Match 1 of 4')
    expect(document.querySelector('[data-guide-search-controls]')).not.toHaveAttribute('hidden')
  })

  test('shows the page that holds the first match, when the page shown holds none', () => {
    const shown = vi.fn()
    document.addEventListener('guide-pages:show', shown, { capture: true })

    searchAt(placedPage(), MATCHES.slice(1))
    document.removeEventListener('guide-pages:show', shown, { capture: true })

    expect(positionText()).toBe('Match 1 of 3')
    expect(shown.mock.calls.map(([event]) => event.target.dataset.guidePage)).toEqual(['2'])
  })

  describe('on a page opened at a section\'s heading, as a result in the hub links to one', () => {
    const openedAt = (id) => window.history.replaceState(null, '', `#${id}`)

    test('starts at the first match in that section, showing its page', () => {
      const shown = vi.fn()
      document.addEventListener('guide-pages:show', shown, { capture: true })
      openedAt('claims-1')

      searchAt(placedPage())
      document.removeEventListener('guide-pages:show', shown, { capture: true })

      expect(positionText()).toBe('Match 2 of 4')
      expect(shown.mock.calls.map(([event]) => event.target.dataset.guidePage)).toEqual(['2'])
    })

    const stepButton = (name) => () => document.querySelector(`[data-guide-search-step="${name}"]`).click()
    const enter = (shiftKey) => () => document.querySelector('input[name="q"]').dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey, bubbles: true, cancelable: true })
    )

    test.each([
      ['Next', stepButton('next'), 'Match 3 of 4'],
      ['Previous', stepButton('previous'), 'Match 1 of 4'],
      ['Enter', enter(false), 'Match 3 of 4'],
      ['Shift+Enter', enter(true), 'Match 1 of 4']
    ])('steps on from that match with %s', (_, step, position) => {
      openedAt('claims-1')
      searchAt(placedPage())

      step()

      expect(positionText()).toBe(position)
    })

    test('stays at the start of a section that holds no match, every match marked but none current', () => {
      openedAt('claims-1')

      searchAt(placedPage(), [MATCHES[0], MATCHES[3]])

      expect(painted.get('guide-keyword-match').ranges).toHaveLength(2)
      expect(currentText()).toEqual([])
      expect(positionText()).toBe('')
    })

    test.each([
      ['next', 'Match 2 of 2'],
      ['previous', 'Match 1 of 2']
    ])('steps with %s from a section that holds no match to the match on that side of it', (step, position) => {
      openedAt('claims-1')
      searchAt(placedPage(), [MATCHES[0], MATCHES[3]])

      document.querySelector(`[data-guide-search-step="${step}"]`).click()

      expect(positionText()).toBe(position)
    })

    test('stays after the last match, at a section after it, when the viewer draws the guide anew', async () => {
      openedAt('checks')
      searchAt(placedPage(), MATCHES.slice(0, 3))
      const paintedFirst = painted.get('guide-keyword-match')
      const text = document.querySelector('[data-guide-page="2"] .app-guide-markdown')

      text.replaceChildren(...text.cloneNode(true).childNodes)
      await vi.waitFor(() => expect(painted.get('guide-keyword-match')).not.toBe(paintedFirst))

      expect(positionText()).toBe('')
      expect(currentText()).toEqual([])
    })

    test('stays at the top of the guide, opened there for its Introduction, when the Introduction holds no match', () => {
      openedAt('main-content')
      searchAt(placedPage(), MATCHES.slice(1))

      expect(positionText()).toBe('')
      document.querySelector('[data-guide-search-step="next"]').click()
      expect(positionText()).toBe('Match 1 of 3')
    })

    test('starts at the first match on a page that is shown, when no section starts at that heading', () => {
      openedAt('note')

      searchAt(placedPage())

      expect(positionText()).toBe('Match 1 of 4')
    })
  })

  test('goes to the next match with Next, and round from the last to the first', () => {
    searchAt(placedPage())
    const next = document.querySelector('[data-guide-search-step="next"]')

    next.click()
    expect(positionText()).toBe('Match 2 of 4')
    for (let step = 0; step < 3; step += 1) {
      next.click()
    }
    expect(positionText()).toBe('Match 1 of 4')
  })

  test('goes to the next match with Enter in the search box, and the one before with Shift+Enter', () => {
    searchAt(placedPage())
    const input = document.querySelector('input[name="q"]')

    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(positionText()).toBe('Match 2 of 4')
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }))
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }))
    expect(positionText()).toBe('Match 4 of 4')
  })

  test('goes to the first match under a contents entry when its count is clicked, showing the page that holds it', () => {
    searchAt(placedPage())
    const shown = vi.fn()
    document.querySelector('[data-guide-page="2"]').addEventListener('guide-pages:show', shown)

    document.querySelector('.app-guide-contents__count').click()

    expect(positionText()).toBe('Match 2 of 4')
    expect(currentText()).toEqual(['Pay'])
    expect(shown).toHaveBeenCalled()
  })

  test('makes each contents count a button, which the keyboard can reach, named for what it does', () => {
    searchAt(placedPage())

    const count = within(document.body).getByRole('button', { name: '2 matches: go to the first' })

    expect(count).toHaveAttribute('type', 'button')
    expect(count).toHaveClass('app-guide-contents__count')
    expect(count).toHaveAttribute('data-guide-search-first', '2')
  })

  test('places the matches again when the viewer draws the guide anew, as it does after the script starts', async () => {
    searchAt(placedPage())
    const text = document.querySelector('[data-guide-page="2"] .app-guide-markdown')

    // The viewer replaces the server's HTML with its own, which has the same words.
    text.replaceChildren(...text.cloneNode(true).childNodes)

    await vi.waitFor(() => {
      const placed = painted.get('guide-keyword-match').ranges

      expect(placed.map(range => range.toString())).toEqual(['Pay', 'Pay', 'Pay', 'Pay'])
    })
  })

  test('brings Ctrl+F to the search box after a contents count is clicked, though the focus is already there', () => {
    searchAt(placedPage())
    const input = document.querySelector('input[name="q"]')

    document.querySelector('.app-guide-contents__count').click()
    const event = new window.KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true })
    document.activeElement.dispatchEvent(event)

    expect(input.value.slice(input.selectionStart, input.selectionEnd)).toBe('pay')
    expect(event).toHaveProperty('defaultPrevented', true)
  })

  test('goes on to the next match with Enter after a contents count is clicked', () => {
    searchAt(placedPage())
    const input = document.querySelector('input[name="q"]')

    // The browser takes the focus from the box when the count is pressed.
    input.blur()
    document.querySelector('.app-guide-contents__count').click()
    document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    expect(positionText()).toBe('Match 3 of 4')
  })
})

/** The guide's page that `placeMatches`' tests read. */
function placedPage () {
  return `
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
