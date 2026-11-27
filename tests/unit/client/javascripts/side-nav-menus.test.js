// @vitest-environment jsdom
import { screen } from '@testing-library/dom'

import { initSideNavMenus } from '../../../../src/client/javascripts/side-nav-menus.js'

describe('initSideNavMenus', () => {
  /** Two pinned guides, each with its menu, as `common/side-nav.njk` makes them. */
  function render () {
    document.body.innerHTML = `
      <nav aria-label="Guidance hub">
        <ul>
          <li>
            <a href="/guides/1">Claiming a payment</a>
            <details data-side-nav-menu>
              <summary>More actions for Claiming a payment</summary>
              <div>
                <a href="/guides/1">Open</a>
                <form method="post" action="/pin-toggle"><button type="submit">Unpin Claiming a payment</button></form>
              </div>
            </details>
          </li>
          <li>
            <a href="/guides/2">Closing a case</a>
            <details data-side-nav-menu>
              <summary>More actions for Closing a case</summary>
              <div><a href="/guides/2">Open</a></div>
            </details>
          </li>
        </ul>
        <a href="/logout">Sign out</a>
      </nav>`
  }

  // jsdom fires a details element's toggle event after a task.
  const toggled = () => new Promise(resolve => setTimeout(resolve))
  const menuOf = (guide) => screen.getByText(`More actions for ${guide}`).parentElement
  const buttonOf = (guide) => screen.getByText(`More actions for ${guide}`)
  const press = (element, key) => element.dispatchEvent(
    new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  )
  const moveFocus = (from, to) => from.dispatchEvent(
    new window.FocusEvent('focusout', { relatedTarget: to, bubbles: true })
  )

  /**
   * @param {string} guide
   * @returns {Promise<HTMLDetailsElement>} The guide's menu, opened
   */
  async function open (guide) {
    const menu = menuOf(guide)

    menu.open = true
    await toggled()

    return menu
  }

  beforeEach(() => {
    render()
    initSideNavMenus()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  test('closes the open menu when another opens', async () => {
    const first = await open('Claiming a payment')
    const second = await open('Closing a case')

    expect(first.open).toBe(false)
    expect(second.open).toBe(true)
  })

  test('closes on Escape, with focus back on the menu\'s button', async () => {
    const menu = await open('Claiming a payment')
    const item = screen.getByRole('button', { name: 'Unpin Claiming a payment' })

    item.focus()
    press(item, 'Escape')

    expect(menu.open).toBe(false)
    expect(buttonOf('Claiming a payment')).toHaveFocus()
  })

  test('keeps Escape to itself, so it does not also close what the menu is in', async () => {
    const heard = vi.fn()

    document.querySelector('nav').addEventListener('keydown', heard)
    await open('Claiming a payment')
    press(buttonOf('Claiming a payment'), 'Escape')

    expect(heard).not.toHaveBeenCalled()
  })

  test('leaves Escape to others when the menu is closed', () => {
    const heard = vi.fn()

    document.querySelector('nav').addEventListener('keydown', heard)
    press(buttonOf('Claiming a payment'), 'Escape')

    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('stays open on any other key', async () => {
    const menu = await open('Claiming a payment')

    press(buttonOf('Claiming a payment'), 'ArrowDown')

    expect(menu.open).toBe(true)
  })

  test('closes when focus moves out of it, and leaves focus where it went', async () => {
    const menu = await open('Claiming a payment')
    const next = screen.getByRole('link', { name: 'Closing a case' })

    next.focus()
    moveFocus(screen.getByRole('button', { name: 'Unpin Claiming a payment' }), next)

    expect(menu.open).toBe(false)
    expect(next).toHaveFocus()
  })

  test('stays open while focus moves within it', async () => {
    const menu = await open('Claiming a payment')

    moveFocus(buttonOf('Claiming a payment'), screen.getByRole('button', { name: 'Unpin Claiming a payment' }))

    expect(menu.open).toBe(true)
  })

  test('stays open when focus leaves the page, as when the user changes window', async () => {
    const menu = await open('Claiming a payment')

    moveFocus(buttonOf('Claiming a payment'), null)

    expect(menu.open).toBe(true)
  })

  test('closes on a click outside it', async () => {
    const menu = await open('Claiming a payment')

    document.querySelector('nav').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(menu.open).toBe(false)
  })

  test('stays open on a click inside it', async () => {
    const menu = await open('Claiming a payment')
    const item = screen.getByRole('button', { name: 'Unpin Claiming a payment' })

    item.form.addEventListener('submit', event => event.preventDefault())
    item.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(menu.open).toBe(true)
  })

  test('does nothing on a page with no menus', () => {
    document.body.innerHTML = '<nav aria-label="Guidance hub"><a href="/hub">Hub</a></nav>'
    const listen = vi.spyOn(document, 'addEventListener')

    initSideNavMenus()

    expect(listen).not.toHaveBeenCalled()
  })
})
