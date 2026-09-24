const POLL_URL = '/create-guidance/upload-guide/processing/status'
const PROCESSING_URL = '/create-guidance/upload-guide/processing'
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
    const {
      label = 'Scanning for viruses',
      percentage = 0,
      isComplete = false,
      isError = false,
      message = null,
      detail = null
    } = data

    this.pollUrl = POLL_URL
    this.processingUrl = PROCESSING_URL
    this.redirectUrl = REDIRECT_URL
    this.retryUrl = RETRY_URL

    this.label = label
    this.percentage = percentage
    this.isComplete = isComplete
    this.isError = isError
    this.errorMessage = this.#buildErrorField(isError, message)
    this.errorDetail = this.#buildErrorField(isError, detail)

    this.refreshSeconds = this.#buildRefreshSeconds(isComplete, isError)

    this.pageTitle = this.#buildPageTitle(isError)
  }

  /**
   * @param {boolean} isError
   * @param {string|null} value
   * @returns {string|null}
   */
  #buildErrorField (isError, value) {
    return isError ? value : null
  }

  /**
   * @param {boolean} isComplete
   * @param {boolean} isError
   * @returns {number|null}
   */
  #buildRefreshSeconds (isComplete, isError) {
    return isComplete || isError ? null : REFRESH_SECONDS
  }

  /**
   * @param {boolean} isError
   * @returns {string}
   */
  #buildPageTitle (isError) {
    return isError ? 'Error: Document upload' : 'Document upload'
  }

  page = 'upload processing'
}

export {
  UploadProcessingViewModel
}
