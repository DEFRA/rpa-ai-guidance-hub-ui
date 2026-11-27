// @vitest-environment jsdom
import { screen } from '@testing-library/dom'

import { initFocusReturn } from '../../../../src/client/javascripts/focus-return.js'

describe('initFocusReturn', () => {
  /**
   * A page with the open side navigation's button, the page widths and a
   * button that asks for nothing, as the templates make them.
   *
   * @param {string} [toggle='Collapse navigation'] - The navigation's button
   * @returns {void}
   */
  function render (toggle = 'Collapse navigation') {
    document.body.innerHTML = `
      <form id="side-nav-toggle-form" method="post" action="/side-nav/toggle" hidden></form>
      <button type="submit" form="side-nav-toggle-form" data-focus-return="side-nav-toggle">${toggle}</button>
      <form method="post" action="/guides/reading-width">
        <button type="submit" name="width" value="standard" data-focus-return="reading-width-standard">Standard</button>
        <button type="submit" name="width" value="wide" data-focus-return="reading-width-wide">Wide</button>
      </form>
      <form method="post" action="/pin-toggle"><button type="submit">Pin guide</button></form>`
    // jsdom cannot send a form, and says so when asked to.
    document.querySelectorAll('form').forEach((form) => {
      form.submit = vi.fn()
      form.requestSubmit = (submitter) => {
        const event = new window.SubmitEvent('submit', { submitter, bubbles: true, cancelable: true })

        if (form.dispatchEvent(event)) {
          form.submit()
        }
      }
    })
  }

  /**
   * Presses a button on one page and loads the next, which the form's reply
   * sends the browser to.
   *
   * @param {string} name - The button pressed
   * @param {() => void} [nextPage] - Renders the page that comes back
   * @returns {void}
   */
  function pressAndReload (name, nextPage = render) {
    const button = screen.getByRole('button', { name })

    button.form.requestSubmit(button)
    nextPage()
    initFocusReturn()
  }

  beforeEach(() => {
    window.sessionStorage.clear()
    render()
    initFocusReturn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  test('leaves focus where the browser puts it on a page the user just opened', () => {
    expect(document.body).toHaveFocus()
  })

  test('puts focus back on the control that reloaded the page', () => {
    pressAndReload('Wide')

    expect(screen.getByRole('button', { name: 'Wide' })).toHaveFocus()
  })

  test('puts focus on the control that has taken its place', () => {
    pressAndReload('Collapse navigation', () => render('Expand navigation'))

    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveFocus()
  })

  test('passes over a control that cannot take focus for the next of its name', () => {
    pressAndReload('Collapse navigation', () => {
      render('Expand navigation')
      screen.getByRole('button', { name: 'Expand navigation' }).disabled = true
      document.body.insertAdjacentHTML('beforeend', '<button type="button" data-focus-return="side-nav-toggle">Open navigation</button>')
    })

    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveFocus()
  })

  test('does it once: the page after that starts as any other', () => {
    pressAndReload('Wide')
    render()
    initFocusReturn()

    expect(document.body).toHaveFocus()
  })

  test('leaves focus alone when the page that comes back has no such control', () => {
    pressAndReload('Wide', () => { document.body.innerHTML = '<h1>Sorry, there is a problem with the service</h1>' })

    expect(document.body).toHaveFocus()
  })

  test('leaves focus alone after a control that did not ask for it', () => {
    pressAndReload('Pin guide')

    expect(document.body).toHaveFocus()
  })

  test('leaves focus alone after a form another script dealt with on the page', () => {
    const wide = screen.getByRole('button', { name: 'Wide' })

    wide.form.addEventListener('submit', event => event.preventDefault())
    pressAndReload('Wide')

    expect(wide.form.submit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Wide' })).not.toHaveFocus()
  })

  test('still sends the form, and loads the next page, where the browser keeps nothing for the page', () => {
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(window.Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })

    const { form } = screen.getByRole('button', { name: 'Wide' })

    expect(() => pressAndReload('Wide')).not.toThrow()
    expect(form.submit).toHaveBeenCalledTimes(1)
    expect(document.body).toHaveFocus()
  })
})
