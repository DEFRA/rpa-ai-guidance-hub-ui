/**
 * Client polling for upload processing status.
 *
 * Periodically fetches the panel's `data-poll-url` and updates the progress
 * bar, label and messages until the server reports completion or an error,
 * or the poll has run for longer than MAX_POLL_DURATION_MS. Uses chained
 * `setTimeout` calls so requests never overlap.
 *
 * The page is fully usable without this script: the server renders the
 * current state and a `<meta http-equiv="refresh">` keeps it current.
 */

const START_DELAY_MS = 2000
const POLL_INTERVAL_MS = 5000
const REDIRECT_DELAY_MS = 1500
const MAX_POLL_DURATION_MS = 2 * 60 * 1000

const ERROR_CLASS = 'app-progress--error'
const BAR_ERROR_CLASS = 'app-progress__bar--error'

/**
 * Selectors for the parts of the panel this script updates.
 */
const SELECTORS = {
  panel: '.app-progress',
  bar: '[data-progress-bar]',
  label: '[data-progress-label]',
  track: '[role="progressbar"]',
  error: '[data-progress-error]',
  errorMessage: '[data-progress-error-message]',
  waiting: '[data-progress-waiting]',
  retry: '[data-progress-retry]',
  complete: '[data-progress-complete]',
  timeout: '[data-progress-timeout]'
}

/**
 * Initialize polling for elements with a `data-poll-url` attribute.
 */
function initPolling () {
  const panels = document.querySelectorAll('[data-poll-url]')

  for (const panel of panels) {
    _setupPolling(panel)
  }
}

/**
 * Apply the server-rendered percentage and, unless the server already
 * reported a failure, start polling.
 *
 * @param {HTMLElement} panel - Element carrying `data-poll-url` and `data-redirect-url`
 */
function _setupPolling (panel) {
  const bar = panel.querySelector(SELECTORS.bar)

  if (bar) {
    bar.style.width = `${bar.dataset.percentage}%`
  }

  if (panel.querySelector(`.${ERROR_CLASS}`)) {
    return
  }

  const deadline = Date.now() + MAX_POLL_DURATION_MS

  setTimeout(() => _poll(panel, deadline), START_DELAY_MS)
}

/**
 * Fetch the latest state once, render it, then decide whether to poll again.
 *
 * @param {HTMLElement} panel
 * @param {number} deadline - Epoch ms after which polling gives up
 */
async function _poll (panel, deadline) {
  const state = await _fetchState(panel.dataset.pollUrl)

  if (state) {
    _render(panel, state)
  }

  if (state?.isComplete) {
    setTimeout(() => globalThis.location.assign(panel.dataset.redirectUrl), REDIRECT_DELAY_MS)
    return
  }

  if (state?.isError) {
    return
  }

  if (Date.now() >= deadline) {
    _show(panel, SELECTORS.timeout)
    _hide(panel, SELECTORS.waiting)
    return
  }

  setTimeout(() => _poll(panel, deadline), POLL_INTERVAL_MS)
}

/**
 * @param {string} pollUrl
 * @returns {Promise<Object|null>} The state, or null when the request failed
 */
async function _fetchState (pollUrl) {
  try {
    const response = await fetch(pollUrl, { headers: { accept: 'application/json' } })

    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

/**
 * Update the panel to reflect a state returned by the poll endpoint.
 *
 * @param {HTMLElement} panel
 * @param {{percentage: number, label: string, message?: string|null, isComplete: boolean, isError: boolean}} state
 */
function _render (panel, state) {
  const bar = panel.querySelector(SELECTORS.bar)
  const label = panel.querySelector(SELECTORS.label)
  const track = panel.querySelector(SELECTORS.track)

  if (bar) {
    bar.style.width = `${state.percentage}%`
    bar.classList.toggle(BAR_ERROR_CLASS, state.isError)
  }

  if (track) {
    track.setAttribute('aria-valuenow', String(state.percentage))
  }

  if (label) {
    label.textContent = state.label
  }

  panel.querySelector(SELECTORS.panel)?.classList.toggle(ERROR_CLASS, state.isError)

  if (state.isError) {
    _renderError(panel, state.message)
  }

  if (state.isComplete) {
    _show(panel, SELECTORS.complete)
    _hide(panel, SELECTORS.waiting)
  }
}

/**
 * @param {HTMLElement} panel
 * @param {string|null} [message]
 */
function _renderError (panel, message) {
  const errorMessage = panel.querySelector(SELECTORS.errorMessage)

  if (errorMessage && message) {
    errorMessage.textContent = message
  }

  _hide(panel, SELECTORS.waiting)
  _show(panel, SELECTORS.retry)
  _show(panel, SELECTORS.error)

  panel.querySelector(SELECTORS.error)?.focus()
}

function _show (panel, selector) {
  const element = panel.querySelector(selector)

  if (element) {
    element.hidden = false
  }
}

function _hide (panel, selector) {
  const element = panel.querySelector(selector)

  if (element) {
    element.hidden = true
  }
}

export {
  initPolling
}
