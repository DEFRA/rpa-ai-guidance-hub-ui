const HIDDEN_CLASS = 'app-hub-columns--filters-hidden'

/**
 * Shows or hides the filter panel, keeping the button's name and state true.
 *
 * @param {HTMLButtonElement} button - The toggle, controlling the panel
 * @returns {void}
 */
function toggle (button) {
  const panel = document.getElementById(button.getAttribute('aria-controls'))
  const label = button.querySelector('[data-filters-toggle-label]')
  const hiding = button.getAttribute('aria-expanded') === 'true'

  panel.hidden = hiding
  button.setAttribute('aria-expanded', String(!hiding))
  label.textContent = hiding ? 'Show filters' : 'Hide filters'
  panel.closest('.app-hub-columns')?.classList.toggle(HIDDEN_CLASS, hiding)
}

/**
 * Reveals the toggle, which has no use without JavaScript, and wires it up.
 *
 * @returns {void}
 */
function initFiltersToggle () {
  document.querySelectorAll('[data-filters-toggle]').forEach((button) => {
    button.hidden = false
    button.addEventListener('click', () => toggle(button))
  })
}

export { initFiltersToggle }
