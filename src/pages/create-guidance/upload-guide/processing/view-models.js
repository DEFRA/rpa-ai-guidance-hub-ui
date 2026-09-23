const POLL_URL = '/create-guidance/upload-guide/processing/status'
const REDIRECT_URL = '/create-guidance/upload-guide/metadata'
const RETRY_URL = '/create-guidance/upload-guide'

/**
 * Seconds between automatic page refreshes for users without JavaScript.
 * @type {number}
 */
const REFRESH_SECONDS = 5

/**
 * View model for the "Document upload" processing page.
 */
class UploadProcessingViewModel {
  /**
   * Create the view model
   *
   * @param {Object} [data={}]
   * @param {string} [data.label] - User-facing progress label
   * @param {number} [data.percentage] - Progress bar percentage (0-100)
   * @param {boolean} [data.isComplete] - Whether processing is complete
   * @param {boolean} [data.isError] - Whether processing encountered an error
   * @param {string|null} [data.message] - User-facing explanation of an error
   * @param {string|null} [data.detail] - Optional supporting copy for an error
   */
  constructor (data = {}) {
    this.pollUrl = POLL_URL
    this.redirectUrl = REDIRECT_URL
    this.retryUrl = RETRY_URL

    this.label = data.label ?? 'Scanning for viruses'
    this.percentage = data.percentage ?? 0
    this.isComplete = data.isComplete ?? false
    this.isError = data.isError ?? false
    this.errorMessage = this.isError ? (data.message ?? null) : null
    this.errorDetail = this.isError ? (data.detail ?? null) : null

    // Only keep refreshing while there is something to wait for.
    this.refreshSeconds = this.isComplete || this.isError ? null : REFRESH_SECONDS

    this.pageTitle = this.isError ? 'Error: Document upload' : 'Document upload'
  }

  page = 'upload processing'
}

export {
  UploadProcessingViewModel
}
