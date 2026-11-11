/**
 * @module The information button beside a guide's title. Without JavaScript
 * it sends the user's choice in its form and the page comes back with the
 * information shown or hidden. With it, the information is shown or hidden at
 * once, the button says what a press will do next, and the choice is sent
 * behind the scenes, so the next page shows it the same way.
 */

/**
 * @private
 * @returns {void} Nothing to do: the information is already shown or hidden
 *   on this page, and an unsent choice only means the next page shows it as
 *   it was
 */
function _keepThePageAsItIs () {
  // Nothing to undo: the page already shows the user's choice.
}

/**
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} information
 * @returns {void}
 */
function toggleGuideInfo (button, information) {
  const { form } = button
  const tooltip = button.querySelector('[data-guide-info-tooltip]')

  form.addEventListener('submit', (event) => {
    event.preventDefault()

    const choice = new URLSearchParams(new FormData(form))
    const shown = choice.get('shown') === 'true'

    information.hidden = !shown
    button.setAttribute('aria-expanded', String(shown))
    tooltip.textContent = shown ? 'Hide guide information' : 'Show guide information'
    form.elements.shown.value = String(!shown)

    window.fetch(form.action, { method: 'post', body: choice, redirect: 'manual' }).catch(_keepThePageAsItIs)
  })
}

/**
 * @returns {void}
 */
function initGuideInfo () {
  const button = document.querySelector('[data-guide-info-toggle]')
  const information = document.querySelector('[data-guide-info]')

  if (button && information) {
    toggleGuideInfo(button, information)
  }
}

export { initGuideInfo }
