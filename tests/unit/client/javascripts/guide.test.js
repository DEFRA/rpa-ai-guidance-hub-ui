// @vitest-environment jsdom
import { initRailTooltips } from '../../../../src/client/javascripts/guide.js'

const DISMISSED = 'app-side-nav__rail-item--tooltip-dismissed'

// The guide viewer draws its headings' controls after the page has started, so
// each control here is drawn after the tooltips are set going.
describe('initRailTooltips', () => {
  let control, other

  beforeAll(() => {
    document.body.innerHTML = '<main></main>'
    initRailTooltips()
  })

  beforeEach(() => {
    document.querySelector('main').innerHTML = '<a href="/bookmark" data-side-nav-tooltip><span>Bookmark</span></a><a href="/other">Other</a>'
    control = document.querySelector('[data-side-nav-tooltip]')
    other = document.querySelector('a[href="/other"]')
  })

  function pressEscape () {
    document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }

  test('lets Esc dismiss the tooltip of a control drawn later, while the control has focus', () => {
    control.focus()

    pressEscape()

    expect(control.classList.contains(DISMISSED)).toBe(true)
  })

  test('shows the tooltip again once the control loses focus', () => {
    control.focus()
    pressEscape()

    other.focus()

    expect(control.classList.contains(DISMISSED)).toBe(false)
  })

  test('shows the tooltip again once the pointer leaves the control, and not while it moves within it', () => {
    control.classList.add(DISMISSED)

    control.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true, relatedTarget: control.firstChild }))
    const whileWithin = control.classList.contains(DISMISSED)
    control.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true, relatedTarget: other }))

    expect(whileWithin).toBe(true)
    expect(control.classList.contains(DISMISSED)).toBe(false)
  })
})
