// @vitest-environment jsdom
import { screen, within } from '@testing-library/dom'

import { anchorRead, followedAddress, initGuideContents, namesTwoPlaces, scrollShowing } from '../../../../src/client/javascripts/guide-contents.js'

const GUIDE = '/guides/guide-1'

describe('followedAddress', () => {
  describe('in the traditional view', () => {
    test('is the guide\'s address at the heading being read, without the section a link from elsewhere named', () => {
      const location = { pathname: GUIDE, search: '?section=assign-case', hash: '#assign-case' }

      expect(followedAddress(location, { anchor: '21-check', page: 'assign-case' }, false)).toBe(`${GUIDE}#21-check`)
    })

    test('keeps the rest of the query', () => {
      const location = { pathname: GUIDE, search: '?from=hub&section=assign-case', hash: '' }

      expect(followedAddress(location, { anchor: '21-check', page: 'assign-case' }, false)).toBe(`${GUIDE}?from=hub#21-check`)
    })

    test('has no fragment where the reader has reached no heading, at the start of the guide', () => {
      expect(followedAddress({ pathname: GUIDE, search: '', hash: '#21-check' }, { anchor: '', page: '' }, false)).toBe(GUIDE)
    })

    test('escapes the anchor for the address', () => {
      expect(followedAddress({ pathname: GUIDE, search: '', hash: '' }, { anchor: 'a b', page: '' }, false)).toBe(`${GUIDE}#a%20b`)
    })
  })

  describe('in the stepper', () => {
    test('names the heading being read as the section, with no fragment', () => {
      const location = { pathname: GUIDE, search: '?section=assign-case', hash: '#assign-case' }

      expect(followedAddress(location, { anchor: '21-check', section: '21-check', page: 'assign-case' }, true)).toBe(`${GUIDE}?section=21-check`)
    })

    test('names the heading by the anchor the hub knows it by, where that differs from its anchor on the page', () => {
      const location = { pathname: GUIDE, search: '', hash: '' }

      expect(followedAddress(location, { anchor: 'help-1', section: 'help', page: 'one' }, true)).toBe(`${GUIDE}?section=help`)
    })

    test('names the page\'s own section at its start, and none for a first page without a heading', () => {
      const location = { pathname: GUIDE, search: '?section=21-check', hash: '' }

      expect(followedAddress(location, { anchor: '', section: '', page: 'assign-case' }, true)).toBe(`${GUIDE}?section=assign-case`)
      expect(followedAddress(location, { anchor: '', section: '', page: '' }, true)).toBe(GUIDE)
    })
  })

  test('is nothing when the address names the place already, so it is left as it is', () => {
    expect(followedAddress({ pathname: GUIDE, search: '', hash: '#21-check' }, { anchor: '21-check', page: 'assign-case' }, false)).toBeNull()
    expect(followedAddress({ pathname: GUIDE, search: '', hash: '#a%20b' }, { anchor: 'a b', page: '' }, false)).toBeNull()
    expect(followedAddress({ pathname: GUIDE, search: '?section=21-check', hash: '' }, { anchor: '21-check', section: '21-check', page: 'assign-case' }, true)).toBeNull()
  })
})

describe('namesTwoPlaces', () => {
  test('is true for an address whose section and fragment name different places', () => {
    expect(namesTwoPlaces({ search: '?section=3-transitions', hash: '#1-introduction' })).toBe(true)
  })

  test('is false for one that names its place twice, or once', () => {
    expect(namesTwoPlaces({ search: '?section=3-transitions', hash: '#3-transitions' })).toBe(false)
    expect(namesTwoPlaces({ search: '?section=3-transitions', hash: '' })).toBe(false)
    expect(namesTwoPlaces({ search: '', hash: '#1-introduction' })).toBe(false)
  })
})

describe('anchorRead', () => {
  test('is the anchor of the heading the reader has reached', () => {
    expect(anchorRead({ top: 100, anchor: '21-check' }, 120)).toBe('21-check')
  })

  test('is none above the first heading, at the start of the guide, though its entry is marked', () => {
    expect(anchorRead({ top: 300, anchor: 'introduction' }, 120)).toBe('')
  })
})

describe('scrollShowing', () => {
  const inSight = { top: 200, bottom: 900 }

  test('is nothing for an entry in sight', () => {
    expect(scrollShowing({ top: 300, bottom: 330 }, inSight)).toBe(0)
  })

  test('scrolls back to an entry above what is in sight', () => {
    expect(scrollShowing({ top: 150, bottom: 180 }, inSight)).toBe(-50)
  })

  test('scrolls on to an entry below what is in sight', () => {
    expect(scrollShowing({ top: 890, bottom: 920 }, inSight)).toBe(20)
  })
})

describe('a guide\'s contents following the reader', () => {
  /**
   * A guide in the traditional view, as `guide/page.njk` makes it, each heading
   * placed down the window, and the contents' own entries too, so the script
   * can tell what is in sight.
   */
  function render (tops) {
    document.body.innerHTML = `
      <div class="app-guide-contents" id="guide-contents" data-guide-format="traditional">
        <nav aria-label="Contents">
          <p data-guide-contents-page="1"><a href="#introduction" data-guide-contents-target="introduction">Introduction</a></p>
          <p data-guide-contents-page="2"><a href="#assign-case" data-guide-contents-target="assign-case">Assign case</a></p>
          <ol><li><a href="#21-check" data-guide-contents-target="21-check">2.1 Check</a></li></ol>
        </nav>
      </div>
      <div data-guide-page="1" data-guide-page-href="${GUIDE}?section=introduction"><h2 id="introduction">Introduction</h2></div>
      <div data-guide-page="2" data-guide-page-href="${GUIDE}?section=assign-case"><h2 id="assign-case">Assign case</h2><h3 id="21-check">2.1 Check</h3></div>`

    // jsdom lays nothing out, so each place says where it is, and the
    // contents pane takes the scroll that keeps an entry in sight.
    const placeAt = (element, top) => {
      element.getBoundingClientRect = () => ({ top, bottom: top + 30 })
      element.getClientRects = () => [{ top }]
    }
    document.querySelectorAll('[data-guide-page], nav a, #guide-contents').forEach(element => placeAt(element, 0))
    for (const [id, top] of Object.entries(tops)) {
      placeAt(document.getElementById(id), top)
    }
    document.getElementById('guide-contents').scrollBy = vi.fn()

    initGuideContents()
  }

  const contents = () => within(screen.getByRole('navigation', { name: 'Contents' }))

  beforeEach(() => {
    window.history.replaceState(null, '', `${GUIDE}?section=assign-case#assign-case`)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('marks the entry for the heading being read as where the reader is', () => {
    render({ introduction: -900, 'assign-case': -200, '21-check': 60 })

    expect(contents().getByRole('link', { name: '2.1 Check' })).toHaveAttribute('aria-current', 'location')
    expect(contents().getByRole('link', { name: 'Assign case' })).not.toHaveAttribute('aria-current')
  })

  test('leaves the address as the link named it until the reader moves, then names the heading being read, once', async () => {
    render({ introduction: -900, 'assign-case': -200, '21-check': 60 })

    expect(window.location.search + window.location.hash).toBe('?section=assign-case#assign-case')

    window.dispatchEvent(new window.WheelEvent('wheel'))
    await new Promise(resolve => window.requestAnimationFrame(resolve))

    expect(window.location.search + window.location.hash).toBe('#21-check')
  })

  test('in the stepper names a repeated heading by the hub\'s anchor, so the address opens the page the reader is on', async () => {
    // `# Help`, `## One` / `### Help`, `## Two` / `### Help`: the page numbers
    // the title too, so the first `### Help` is `help-1` there and `help` to
    // the hub, whose `help-1` is the second.
    document.body.innerHTML = `
      <div class="app-guide-contents" id="guide-contents" data-guide-format="stepper">
        <nav aria-label="Contents">
          <p data-guide-contents-page="1"><a href="${GUIDE}?section=one" data-guide-contents-target="one" data-guide-contents-section="one" aria-current="page">One</a></p>
          <ol><li><a href="#help-1" data-guide-contents-target="help-1" data-guide-contents-section="help">Help</a></li></ol>
          <p data-guide-contents-page="2"><a href="${GUIDE}?section=two" data-guide-contents-target="two" data-guide-contents-section="two">Two</a></p>
          <ol><li><a href="${GUIDE}?section=two#help-2" data-guide-contents-target="help-2" data-guide-contents-section="help-1">Help</a></li></ol>
        </nav>
      </div>
      <div data-guide-page="1" data-guide-page-href="${GUIDE}?section=one"><h2 id="one">One</h2><h3 id="help-1">Help</h3></div>
      <div data-guide-page="2" data-guide-page-href="${GUIDE}?section=two" hidden="until-found"><h2 id="two">Two</h2><h3 id="help-2">Help</h3></div>`

    const placeAt = (element, top) => {
      element.getBoundingClientRect = () => ({ top, bottom: top + 30 })
      element.getClientRects = () => [{ top }]
    }
    document.querySelectorAll('[data-guide-page], nav a, #guide-contents').forEach(element => placeAt(element, 0))
    placeAt(document.getElementById('one'), -200)
    placeAt(document.getElementById('help-1'), 60)
    document.getElementById('guide-contents').scrollBy = vi.fn()
    window.history.replaceState(null, '', `${GUIDE}?section=one`)

    initGuideContents()
    window.dispatchEvent(new window.WheelEvent('wheel'))
    await new Promise(resolve => window.requestAnimationFrame(resolve))

    expect(window.location.search + window.location.hash).toBe('?section=help')
  })
})
