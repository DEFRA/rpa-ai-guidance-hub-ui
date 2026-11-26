/**
 * @module The keys that bring the focus to a search box, each shown in its
 * box: Ctrl+K (Cmd+K on a Mac) to the box that searches all guides, here, and
 * Ctrl+F to the search in a guide (guide-search.js).
 */

// The boxes that search all guides: the hub's own, which takes the side
// navigation's place on the hub, else the side navigation's. Inputs only: a
// guide's heading called "Hub search" has the same id.
const ALL_GUIDES_BOXES = ['input#hub-search', 'input#side-nav-search']

// The toolbar's button while the side navigation is a closed drawer: it says
// whether the drawer is open only on a narrow window (side-nav-drawer.js).
const CLOSED_DRAWER_TOGGLE = '[data-side-nav-toolbar-toggle][aria-expanded="false"]'

// The platforms whose keyboards have Cmd.
const APPLE = ['Mac', 'iPhone', 'iPad']

/**
 * @param {KeyboardEvent} event
 * @param {string} key - In lower case
 * @returns {boolean} Whether it is Ctrl with that key, or Cmd on a Mac, with
 *   no Alt or Shift: those, such as Ctrl+Shift+K, stay the browser's
 */
function isShortcut (event, key) {
  const modified = event.ctrlKey || event.metaKey

  return modified && !event.altKey && !event.shiftKey &&
    event.key.toLowerCase() === key
}

/**
 * @param {string} platform - `navigator.platform`
 * @param {string} key - In lower case
 * @returns {string} The shortcut as the reader's keyboard has it
 */
function shortcutLabel (platform, key) {
  const apple = APPLE.some(name => platform.includes(name))

  return `${apple ? '⌘' : 'Ctrl'} ${key.toUpperCase()}`
}

/**
 * Show a box's shortcut in it while it is empty. A screen reader is told it
 * by the box instead.
 *
 * @param {HTMLInputElement} input
 * @param {string} key - In lower case
 */
function showShortcut (input, key) {
  const kbd = document.createElement('kbd')
  const letter = key.toUpperCase()

  input.setAttribute('aria-keyshortcuts', `Control+${letter} Meta+${letter}`)
  kbd.className = 'app-search-kbd'
  kbd.setAttribute('aria-hidden', 'true')
  kbd.textContent = shortcutLabel(navigator.platform, key)
  kbd.hidden = Boolean(input.value)
  input.after(kbd)
  input.addEventListener('input', () => { kbd.hidden = Boolean(input.value) })
}

/**
 * Ctrl+K comes to the box that searches all guides and selects its words,
 * instead of the browser's own search. A page with no such box, as with the
 * side navigation folded, leaves Ctrl+K to the browser.
 *
 * @returns {void}
 */
function initSearchAllGuides () {
  const input = ALL_GUIDES_BOXES
    .map(box => document.querySelector(box))
    .find(Boolean)

  if (!input) {
    return
  }

  showShortcut(input, 'k')
  document.addEventListener('keydown', (event) => {
    if (isShortcut(event, 'k')) {
      event.preventDefault()
      _openDrawerAround(input)
      input.focus()
      input.select()
    }
  })
}

/**
 * Open the side navigation's drawer if the box is in it and it is closed, as
 * its toolbar's button does: a closed drawer is hidden, and a hidden box
 * cannot take the focus.
 *
 * @private
 * @param {HTMLInputElement} input
 * @returns {void}
 */
function _openDrawerAround (input) {
  if (input.closest('.app-layout__nav')) {
    document.querySelector(CLOSED_DRAWER_TOGGLE)?.click()
  }
}

export {
  initSearchAllGuides,
  isShortcut,
  shortcutLabel,
  showShortcut
}
