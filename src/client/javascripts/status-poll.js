/**
 * Client-side polling for upload processing status.
 *
 * Polls `/status-poll/{uploadId}` on a fixed interval, updating the progress bar
 * and label until the upload is complete or an error occurs. Uses setTimeout
 * chaining (not setInterval) to avoid overlapping requests if a call is slow or
 * the tab was backgrounded.
 */

const START_DELAY_MS = 2000
const POLL_INTERVAL_MS = 5000
const REDIRECT_DELAY_MS = 1500

/**
 * Sets up polling for any element with a [data-poll-url] attribute
 *
 * @returns {void}
 */
function initPolling () {
  const pollingElements = document.querySelectorAll('[data-poll-url]')

  for (const element of pollingElements) {
    _setupPolling(element)
  }
}

/**
 * Start polling for upload status.
 *
 * Reads `pollUrl` and `redirectUrl` from `data-*` attributes on the panel
 * element (populated by the view model / nunjucks template). Updates the bar width
 * and label on each poll tick, and redirects when complete.
 *
 * @param {HTMLElement} panel - The `.app-progress` element with data-poll-url and data-redirect-url
 * @returns {void}
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
 * @private
 * Recursively poll for status updates
 *
 * @param {HTMLElement} panel - The `.app-progress` element to update
 * @param {string} pollUrl
 * @param {string} redirectUrl
 * @returns {void}
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
