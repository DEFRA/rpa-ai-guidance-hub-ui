/**
 * @module Puts focus back on a control whose form reloads the page, such as
 * the button that folds the side navigation away, so a keyboard user carries
 * on from where they were and not from the top of the page. A control asks
 * for it by name (`data-focus-return`); the name is kept only until the next
 * page has loaded, and only in this tab. Focus goes to the control of the
 * same name on that page, which may be another one: "Collapse navigation"
 * comes back as "Expand navigation".
 *
 * Without this script, or where the browser keeps nothing for the page, the
 * controls work the same and focus starts at the top.
 */

const KEY = 'app:focus-return'

/**
 * @private
 * @param {string} name
 * @returns {void}
 */
function _remember (name) {
  try {
    window.sessionStorage.setItem(KEY, name)
  } catch {
    // The browser keeps nothing for the page: see the module's note.
  }
}

/**
 * @private
 * @returns {string|null} The name remembered by the page before, forgotten
 *   as it is read so that no later page acts on it
 */
function _recall () {
  try {
    const name = window.sessionStorage.getItem(KEY)

    window.sessionStorage.removeItem(KEY)

    return name
  } catch {
    return null
  }
}

/**
 * @private
 * @param {HTMLElement} control
 * @returns {boolean} Whether it took focus; one out of sight does not
 */
function _focus (control) {
  control.focus()

  return document.activeElement === control
}

/**
 * @returns {void}
 */
function initFocusReturn () {
  const name = _recall()

  if (name) {
    Array.from(document.querySelectorAll('[data-focus-return]'))
      .filter(control => control.dataset.focusReturn === name)
      .some(_focus)
  }

  document.addEventListener('submit', (event) => {
    const control = event.submitter?.dataset.focusReturn

    // A form another script deals with on the page does not reload it.
    if (control && !event.defaultPrevented) {
      _remember(control)
    }
  })
}

export { initFocusReturn }
