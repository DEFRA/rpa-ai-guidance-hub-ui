// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/dom'

import { initGuideInfo } from '../../../../src/client/javascripts/guide-info.js'

const GUIDE_URL = '/guides/guide-1'

describe('a guide\'s information button, with JavaScript', () => {
  /** The button and the information, hidden, as `guide/page.njk` makes them. */
  function render () {
    document.body.innerHTML = `
      <form method="post" action="/guides/information">
        <input type="hidden" name="shown" value="true">
        <input type="hidden" name="returnTo" value="${GUIDE_URL}">
        <button type="submit" aria-expanded="false" aria-controls="guide-info" data-guide-info-toggle>
          <span>Guide information</span>
          <span aria-hidden="true" data-guide-info-tooltip>Show guide information</span>
        </button>
      </form>
      <div id="guide-info" data-guide-info hidden><dl><dt>Scheme</dt><dd>Not provided</dd></dl></div>`

    initGuideInfo()

    return {
      button: screen.getByRole('button', { name: /Guide information/ }),
      information: document.getElementById('guide-info')
    }
  }

  beforeEach(() => {
    window.fetch = vi.fn(() => Promise.resolve(new window.Response(null, { status: 204 })))
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('shows the information at once, without leaving the page, and says the button now hides it', () => {
    const { button, information } = render()

    fireEvent.click(button)

    expect(information).toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(within(button).getByText('Hide guide information')).toBeInTheDocument()
    expect(button.form).toHaveFormValues({ shown: 'false' })
  })

  test('sends the choice to be kept, as the form would', () => {
    const { button } = render()

    fireEvent.click(button)

    const [address, request] = window.fetch.mock.calls[0]

    expect(new URL(address).pathname).toBe('/guides/information')
    expect(request).toMatchObject({ method: 'post' })
    expect(Object.fromEntries(window.fetch.mock.calls[0][1].body)).toEqual({ shown: 'true', returnTo: GUIDE_URL })
  })

  test('hides the information again', () => {
    const { button, information } = render()

    fireEvent.click(button)
    fireEvent.click(button)

    expect(information).not.toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(Object.fromEntries(window.fetch.mock.calls[1][1].body)).toEqual({ shown: 'false', returnTo: GUIDE_URL })
  })
})
