// @vitest-environment jsdom
import { initFiltersToggle } from '../../../../src/client/javascripts/hub-filters.js'

describe('initFiltersToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button type="button" hidden aria-controls="hub-filters-panel" aria-expanded="true" data-filters-toggle>
        <span><span data-filters-toggle-label>Hide filters</span> (1 applied)</span>
      </button>
      <div class="app-hub-columns"><aside id="hub-filters-panel"></aside></div>`
    initFiltersToggle()
  })

  const button = () => document.querySelector('[data-filters-toggle]')
  const panel = () => document.getElementById('hub-filters-panel')

  test('reveals the button, which has no use without JavaScript', () => {
    expect(button().hidden).toBe(false)
  })

  test('hides the filters and the column they were in, and says they can be shown', () => {
    button().click()

    expect(panel().hidden).toBe(true)
    expect(button().getAttribute('aria-expanded')).toBe('false')
    expect(button().textContent).toContain('Show filters')
    expect(button().textContent).toContain('(1 applied)')
    expect(document.querySelector('.app-hub-columns')).toHaveClass('app-hub-columns--filters-hidden')
  })

  test('shows them again on the next click', () => {
    button().click()
    button().click()

    expect(panel().hidden).toBe(false)
    expect(button().getAttribute('aria-expanded')).toBe('true')
    expect(button().textContent).toContain('Hide filters')
    expect(document.querySelector('.app-hub-columns')).not.toHaveClass('app-hub-columns--filters-hidden')
  })
})
