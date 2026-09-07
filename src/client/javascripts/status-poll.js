/**
 * Simple client polling for upload processing status.
 *
 * Periodically fetches the provided `pollUrl` and updates the progress bar
 * and label until complete or an error occurs. Uses chained `setTimeout`
 * calls to reduce the risk of overlapping requests.
 */

const START_DELAY_MS = 2000
const POLL_INTERVAL_MS = 5000
const REDIRECT_DELAY_MS = 1500

/**
 * Initialize polling for elements with a `data-poll-url` attribute.
 */
function initPolling () {
  const pollingElements = document.querySelectorAll('[data-poll-url]')

  for (const element of pollingElements) {
    _setupPolling(element)
  }
}

/**
 * Start polling for a panel's upload status.
 *
 * Expects `data-poll-url` and optional `data-redirect-url` on `panel` (usually
 * set by the server-side template). Redirects when the server reports
 * completion.
 *
 * @param {HTMLElement} panel The `.app-progress` element to monitor.
 */
function _setupPolling (panel) {
  const pollUrl = panel.dataset.pollUrl
  const redirectUrl = panel.dataset.redirectUrl

  if (!pollUrl) {
    console.warn('No pollUrl found for progress panel', panel)
    return
  }

  setTimeout(function () {
    _doPoll(panel, pollUrl, redirectUrl)
  }, START_DELAY_MS)
}

/**
 * Poll `pollUrl` and update the UI in `panel`. Redirects when complete.
 *
 * @param {HTMLElement} panel The `.app-progress` element to update.
 * @param {string} pollUrl
 * @param {string} redirectUrl
 */
function _doPoll (panel, pollUrl, redirectUrl) {
  fetch(pollUrl)
    .then(function (res) {
      return res.json()
    })
    .then(function (state) {
      const bar = panel.querySelector('.app-progress__bar')

      if (bar) {
        bar.style.width = state.percentage + '%'
      }

      const label = panel.querySelector('[data-progress-label]')

      if (label) {
        label.textContent = state.label
      }

      if (state.isComplete) {
        setTimeout(function () {
          globalThis.location.href = redirectUrl
        }, REDIRECT_DELAY_MS)

        return
      }

      if (state.isError) {
        panel.classList.add('app-progress--error')
        bar.classList.add('app-progress__bar--error')

        return
      }

      setTimeout(function () {
        _doPoll(panel, pollUrl, redirectUrl)
      }, POLL_INTERVAL_MS)
    })
    .catch(function () {
      setTimeout(function () {
        _doPoll(panel, pollUrl, redirectUrl)
      }, POLL_INTERVAL_MS)
    })
}

export {
  initPolling
}
