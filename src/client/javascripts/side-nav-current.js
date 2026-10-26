const HUB_PATH = '/hub'

/**
 * Which of the side navigation's links is the current page. Its lists open
 * the hub's tabs (`/hub#pinned`), and the part after # never reaches the
 * server, which marks Hub as current for all of them; the browser knows the
 * tab in the address, and the tab clicked changes it.
 *
 * @param {string} pathname - The page's path
 * @param {string} hash - The address's `#` part, or ''
 * @param {string[]} hrefs - The navigation's links
 * @returns {string|null} The current link, or null on a page other than the
 *   hub, where the server's marking stands
 */
function currentNavHref (pathname, hash, hrefs) {
  if (pathname !== HUB_PATH) {
    return null
  }

  const list = `${HUB_PATH}${hash}`

  return hash && hrefs.includes(list) ? list : HUB_PATH
}

const CURRENT_CLASSES = {
  'app-side-nav__link': 'app-side-nav__link--current',
  'app-side-nav__rail-item': 'app-side-nav__rail-item--current'
}

function _markCurrent (links, current) {
  links.forEach((link) => {
    const isCurrent = link.getAttribute('href') === current
    const base = Object.keys(CURRENT_CLASSES).find((name) => link.classList.contains(name))

    link.classList.toggle(CURRENT_CLASSES[base], isCurrent)

    if (isCurrent) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })
}

/**
 * Keeps the side navigation's current link in step with the hub's tab: on
 * load, and each time the address's `#` part changes.
 *
 * @returns {void}
 */
function initSideNavCurrent () {
  // Only the navigation's items, never the service name, which also links to the hub
  const items = Object.keys(CURRENT_CLASSES).map((name) => `.${name}[href^="/hub"]`).join(', ')
  const links = Array.from(document.querySelectorAll(items))

  if (links.length === 0) {
    return
  }

  const hrefs = links.map((link) => link.getAttribute('href'))
  const sync = () => {
    const current = currentNavHref(window.location.pathname, window.location.hash, hrefs)

    if (current) {
      _markCurrent(links, current)
    }
  }

  window.addEventListener('hashchange', sync)
  sync()
}

export { currentNavHref, initSideNavCurrent }
