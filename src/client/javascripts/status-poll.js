/**
 * Initializes polling and progressive enhancement for the upload status page.
 *
 * @param {HTMLElement} [container] - The container element for the upload status
 */
function initStatusPoll (container = document.getElementById('upload-status-container')) {
  if (!container) {
    return
  }

  const pollUrl = container.dataset.pollUrl
  const redirectUrl = container.dataset.redirectUrl || '/create-guidance/metadata'
  const isReady = container.dataset.isReady === 'true'
  const isError = container.dataset.isError === 'true'

  if (isReady || isError || !pollUrl) {
    return
  }

  // Remove meta refresh if present to prevent page reload during JS polling
  const metaRefresh = document.getElementById('meta-refresh')
  if (metaRefresh) {
    metaRefresh.remove()
  }

  const progressBar = container.querySelector('.app-progress-bar')
  const progressInner = container.querySelector('.app-progress-bar__inner')
  const messageElement = document.getElementById('upload-status-message')

  let currentProgress = 50
  let pollTimer = null

  /**
   * Update the progress bar visually and accessibly
   *
   * @param {number} percentage
   * @param {string} [message]
   */
  function updateProgress (percentage, message) {
    currentProgress = Math.min(100, Math.max(0, percentage))

    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', String(currentProgress))
    }

    if (progressInner) {
      progressInner.style.width = `${currentProgress}%`
    }

    if (message && messageElement) {
      messageElement.textContent = message
    }
  }

  /**
   * Stop polling
   */
  function stopPolling () {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  /**
   * Check status via the JSON polling endpoint
   */
  async function checkStatus () {
    try {
      const response = await fetch(pollUrl, {
        headers: {
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()

      if (data.isReady && !data.hasRejectedFiles) {
        stopPolling()
        updateProgress(100, 'Your document has been verified. Redirecting...')
        window.location.href = data.redirectUrl || redirectUrl
        return
      }

      if (data.hasRejectedFiles || data.uploadStatus === 'rejected') {
        stopPolling()
        const errorMsg = data.files?.find((f) => f.error)?.error?.message ||
          'The uploaded file failed verification checks'
        updateProgress(100, errorMsg)

        // Reload page to display full error summary and retry button
        window.location.reload()
        return
      }

      if (currentProgress < 90) {
        updateProgress(currentProgress + 5)
      }
    } catch {
      // Keep polling on transient network failure
    }
  }

  pollTimer = setInterval(checkStatus, 2000)
}

export {
  initStatusPoll
}
