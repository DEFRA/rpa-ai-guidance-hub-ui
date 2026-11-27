/**
 * @module The side navigation's "More actions" menus, as the prototype's
 * (rpa-ai-guidance-hub-prototype: app/assets/javascripts/side-nav.js). Each
 * is a `<details>` drawn over the rows below it, which opens and closes
 * without JavaScript. With it, a menu also closes on Escape, when focus
 * leaves it, on a click outside it and when another opens, so an open menu
 * does not stay over what the user moves on to.
 */

/**
 * @private
 * @param {HTMLDetailsElement} menu
 * @param {boolean} returnFocus - Whether focus goes back to the menu's button
 * @returns {void}
 */
function _close (menu, returnFocus) {
  if (!menu.open) {
    return
  }

  menu.open = false

  if (returnFocus) {
    menu.querySelector('summary').focus()
  }
}

/**
 * @private
 * @param {HTMLDetailsElement} menu
 * @param {HTMLDetailsElement[]} menus - Every menu, this one among them
 * @returns {void}
 */
function _closeWhenLeft (menu, menus) {
  menu.addEventListener('toggle', () => {
    if (menu.open) {
      menus.filter(other => other !== menu).forEach(other => _close(other, false))
    }
  })

  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      // The key closes the menu only, not the drawer the menu is in.
      event.stopPropagation()
      _close(menu, true)
    }
  })

  menu.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) {
      _close(menu, false)
    }
  })
}

/**
 * @returns {void}
 */
function initSideNavMenus () {
  const menus = Array.from(document.querySelectorAll('[data-side-nav-menu]'))

  if (!menus.length) {
    return
  }

  menus.forEach(menu => _closeWhenLeft(menu, menus))

  document.addEventListener('click', (event) => {
    menus.filter(menu => !menu.contains(event.target)).forEach(menu => _close(menu, false))
  })
}

export { initSideNavMenus }
