// The side navigation's drawer on a narrow window, or a wider one zoomed in
// until it is as narrow, as the prototype's
// (rpa-ai-guidance-hub-prototype: app/assets/javascripts/side-nav.js).
// Without this script the navigation is stacked above the page instead
// (_app-side-nav.scss), and the toolbar's button folds it away.

const OPEN_CLASS = 'app-layout--drawer-open'
const BACKDROP_CLASS = 'app-layout__backdrop'
// Below GOV.UK Frontend's desktop breakpoint, where the styles make the
// navigation a drawer ($until: desktop).
const NARROW = '(max-width: 768.98px)'
const FOCUSABLE = 'a, button, input:not([type="hidden"]), summary'

/**
 * @typedef {object} Drawer
 * @property {Element} layout - The page's shell, which says the drawer is open
 * @property {Element} nav - The navigation's column, which is the drawer
 * @property {HTMLButtonElement} toggle - The toolbar's button
 * @property {Element} label - The button's name
 * @property {string} wideLabel - Its name on a wide window, where it submits
 *   its form
 * @property {MediaQueryList} narrow - Whether the window is narrow
 * @property {Element|null} backdrop - Covers the page behind the open drawer
 * @property {boolean} open
 */

/**
 * Makes the toolbar's button open and close the side navigation as a drawer
 * while the window is narrow. Opening it moves focus into it; closing it puts
 * focus back on the button. It is not modal: moving focus out of it closes
 * it, rather than focus being kept in.
 *
 * @returns {void}
 */
function initSideNavDrawer () {
  const layout = document.querySelector('[data-side-nav-drawer]')

  if (!layout) {
    return
  }

  const drawer = _drawerOf(layout)

  _closeFromWithin(drawer)
  drawer.toggle.addEventListener('click', (event) => {
    if (!drawer.narrow.matches) {
      return
    }

    // On a narrow window the button opens the drawer, not submits its form.
    event.preventDefault()

    if (drawer.open) {
      _close(drawer, true)
    } else {
      _open(drawer)
    }
  })
  drawer.narrow.addEventListener('change', () => {
    _close(drawer, false)
    _showState(drawer)
  })

  _showState(drawer)
}

/**
 * @private
 * @param {Element} layout
 * @returns {Drawer} Closed
 */
function _drawerOf (layout) {
  const label = layout.querySelector('[data-side-nav-toolbar-label]')

  return {
    layout,
    nav: layout.querySelector('.app-layout__nav'),
    toggle: layout.querySelector('[data-side-nav-toolbar-toggle]'),
    label,
    wideLabel: label.textContent,
    narrow: window.matchMedia(NARROW),
    backdrop: null,
    open: false
  }
}

/**
 * Keeps the button's name and state true to the window and the drawer.
 *
 * @private
 * @param {Drawer} drawer
 * @returns {void}
 */
function _showState (drawer) {
  const { toggle, label, narrow, open } = drawer

  if (narrow.matches) {
    toggle.setAttribute('aria-expanded', String(open))
    label.textContent = open ? 'Close navigation' : 'Open navigation'
  } else {
    toggle.removeAttribute('aria-expanded')
    label.textContent = drawer.wideLabel
  }
}

/**
 * @private
 * @param {Drawer} drawer
 * @returns {void}
 */
function _open (drawer) {
  if (!drawer.backdrop) {
    drawer.backdrop = document.createElement('div')
    drawer.backdrop.className = BACKDROP_CLASS
    drawer.backdrop.addEventListener('click', () => _close(drawer, true))
    drawer.layout.appendChild(drawer.backdrop)
  }

  drawer.open = true
  drawer.layout.classList.add(OPEN_CLASS)
  _showState(drawer)
  drawer.nav.querySelector(FOCUSABLE)?.focus()
}

/**
 * @private
 * @param {Drawer} drawer
 * @param {boolean} returnFocus - Whether focus goes back to the button
 * @returns {void}
 */
function _close (drawer, returnFocus) {
  if (!drawer.open) {
    return
  }

  drawer.open = false
  drawer.layout.classList.remove(OPEN_CLASS)
  _showState(drawer)

  if (returnFocus) {
    drawer.toggle.focus()
  }
}

/**
 * Closes the drawer from inside it: on Escape, on its own collapse button,
 * and when focus leaves it.
 *
 * @private
 * @param {Drawer} drawer
 * @returns {void}
 */
function _closeFromWithin (drawer) {
  const { layout, nav, narrow } = drawer

  // In the drawer the navigation's own "Collapse navigation" just closes it.
  layout.querySelector('[data-side-nav-collapse]')
    ?.addEventListener('click', (event) => {
      if (narrow.matches) {
        event.preventDefault()
        _close(drawer, true)
      }
    })

  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      _close(drawer, true)
    }
  })

  nav.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !nav.contains(event.relatedTarget)) {
      _close(drawer, false)
    }
  })
}

export { initSideNavDrawer }
