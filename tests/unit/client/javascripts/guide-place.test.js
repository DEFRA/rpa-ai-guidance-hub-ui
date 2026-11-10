// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom'

import { initGuidePlace, placeHref, readerPlace } from '../../../../src/client/javascripts/guide-place.js'

const GUIDE_URL = '/guides/guide-1'

describe('readerPlace', () => {
  const marks = [
    { top: -900, href: GUIDE_URL, id: '' },
    { top: -400, href: GUIDE_URL, id: 'introduction' },
    { top: 60, href: `${GUIDE_URL}?section=assign-case`, id: 'assign-case' },
    { top: 500, href: `${GUIDE_URL}?section=assign-case`, id: '21-check' }
  ]

  test('is the last page start or heading that has scrolled up to the reading line', () => {
    expect(readerPlace(marks, 120)).toBe(marks[2])
  })

  test('is the first of them when none has', () => {
    const below = marks.map(mark => ({ ...mark, top: mark.top + 2000 }))

    expect(readerPlace(below, 120)).toBe(below[0])
  })

  test('is nowhere in a page without any', () => {
    expect(readerPlace([], 120)).toBeNull()
  })
})

describe('placeHref', () => {
  test('names the page, for the stepper, and the heading, for the browser to go to', () => {
    expect(placeHref({ href: `${GUIDE_URL}?section=assign-case`, id: '21-check' })).toBe(`${GUIDE_URL}?section=assign-case#21-check`)
  })

  test('names the page alone at its start', () => {
    expect(placeHref({ href: GUIDE_URL, id: '' })).toBe(GUIDE_URL)
  })

  test('encodes the heading', () => {
    expect(placeHref({ href: GUIDE_URL, id: 'før you' })).toBe(`${GUIDE_URL}#f%C3%B8r%20you`)
  })
})

describe('changing the guide\'s format', () => {
  /** The format switch and two pages of a guide, as `guide/page.njk` makes them, each placed down the window. */
  function render (tops) {
    document.body.innerHTML = `
      <form method="post" action="/guides/format">
        <input type="hidden" name="returnTo" value="${GUIDE_URL}?section=introduction" data-guide-place>
        <div role="group" aria-label="Guide format">
          <button type="submit" name="format" value="stepper">Stepper</button>
        </div>
      </form>
      <div data-guide-page="1" data-guide-page-href="${GUIDE_URL}?section=introduction">
        <h2 id="introduction">Introduction</h2>
      </div>
      <div data-guide-page="2" data-guide-page-href="${GUIDE_URL}?section=assign-case">
        <h2 id="assign-case">Assign case</h2>
        <h3 id="21-check">2.1 Check</h3>
      </div>`

    for (const [selector, top] of Object.entries(tops)) {
      document.querySelector(selector).getBoundingClientRect = () => ({ top })
    }

    initGuidePlace()
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('comes back to the heading the reader has scrolled to, on its page', () => {
    render({
      '[data-guide-page="1"]': -1500,
      '[id="introduction"]': -1480,
      '[data-guide-page="2"]': -300,
      '[id="assign-case"]': -280,
      '[id="21-check"]': 40
    })
    const form = screen.getByRole('button', { name: 'Stepper' }).form
    form.addEventListener('submit', event => event.preventDefault())

    fireEvent.submit(form)

    expect(form).toHaveFormValues({ returnTo: `${GUIDE_URL}?section=assign-case#21-check` })
  })
})
