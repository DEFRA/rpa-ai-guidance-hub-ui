// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom'

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
          <span aria-hidden="true">Guide information</span>
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
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new window.Response(null, { status: 204 }))))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  test('shows the information at once, without leaving the page', () => {
    const { button, information } = render()

    fireEvent.click(button)

    expect(information).toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button.form).toHaveFormValues({ shown: 'false' })
  })

  test('sends the choice to be kept, as the form would', async () => {
    const { button } = render()

    fireEvent.click(button)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))

    const [address, request] = fetch.mock.calls[0]

    expect(new URL(address).pathname).toBe('/guides/information')
    expect(request).toMatchObject({ method: 'post' })
    expect(Object.fromEntries(fetch.mock.calls[0][1].body)).toEqual({ shown: 'true', returnTo: GUIDE_URL })
  })

  test('hides the information again', async () => {
    const { button, information } = render()

    fireEvent.click(button)
    fireEvent.click(button)

    expect(information).not.toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(Object.fromEntries(fetch.mock.calls[1][1].body)).toEqual({ shown: 'false', returnTo: GUIDE_URL })
  })

  test('sends the choices one at a time, in the order made, so the last is saved last', async () => {
    const releases = []

    fetch.mockImplementation(() => new Promise(resolve => releases.push(() => resolve(new window.Response(null, { status: 204 })))))

    const { button } = render()

    fireEvent.click(button)
    fireEvent.click(button)

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    expect(Object.fromEntries(fetch.mock.calls[0][1].body)).toMatchObject({ shown: 'true' })

    releases[0]()

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(Object.fromEntries(fetch.mock.calls[1][1].body)).toMatchObject({ shown: 'false' })
  })

  test('still sends the next choice after one fails', async () => {
    fetch.mockRejectedValueOnce(new Error('offline'))

    const { button } = render()

    fireEvent.click(button)
    fireEvent.click(button)

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  })
})
