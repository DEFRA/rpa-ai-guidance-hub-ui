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

  const nav = layout.querySelector('.app-layout__nav')
  const toggle = layout.querySelector('[data-side-nav-toolbar-toggle]')
  const label = layout.querySelector('[data-side-nav-toolbar-label]')
  // What the button does on a wide window, where it submits its form.
  const wideLabel = label.textContent
  const narrow = window.matchMedia(NARROW)
  let backdrop = null
  let open = false

  const showState = () => {
    if (narrow.matches) {
      toggle.setAttribute('aria-expanded', String(open))
      label.textContent = open ? 'Close navigation' : 'Open navigation'
    } else {
      toggle.removeAttribute('aria-expanded')
      label.textContent = wideLabel
    }
  }

  const close = (returnFocus) => {
    if (!open) {
      return
    }

    open = false
    layout.classList.remove(OPEN_CLASS)
    showState()

    if (returnFocus) {
      toggle.focus()
    }
  }

  const show = () => {
    if (!backdrop) {
      backdrop = document.createElement('div')
      backdrop.className = BACKDROP_CLASS
      backdrop.addEventListener('click', () => close(true))
      layout.appendChild(backdrop)
    }

    open = true
    layout.classList.add(OPEN_CLASS)
    showState()
    nav.querySelector(FOCUSABLE)?.focus()
  }

  toggle.addEventListener('click', (event) => {
    if (!narrow.matches) {
      return
    }

    // On a narrow window the button opens the drawer, not submits its form.
    event.preventDefault()

    if (open) {
      close(true)
    } else {
      show()
    }
  })

  // In the drawer the navigation's own "Collapse navigation" just closes it.
  layout.querySelector('[data-side-nav-collapse]')
    ?.addEventListener('click', (event) => {
      if (narrow.matches) {
        event.preventDefault()
        close(true)
      }
    })

  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      close(true)
    }
  })

  nav.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !nav.contains(event.relatedTarget)) {
      close(false)
    }
  })

  narrow.addEventListener('change', () => {
    close(false)
    showState()
  })

  showState()
}

export { initSideNavDrawer }
