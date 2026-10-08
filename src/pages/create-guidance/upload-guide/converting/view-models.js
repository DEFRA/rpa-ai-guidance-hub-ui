const POLL_URL = '/create-guidance/upload-guide/converting/status'
const CONVERTING_URL = '/create-guidance/upload-guide/converting'
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'

/**
 * View model for the "Converting your document" page, which follows the
 * save of a converted document with a progress bar.
 */
class ConvertingViewModel {
  /**
   * @param {Object} [data={}]
   * @param {string} [data.label] - User-facing progress label
   * @param {number} [data.percentage] - Progress bar percentage (0-100)
   * @param {boolean} [data.isError] - Whether the save failed
   * @param {string|null} [data.message] - User-facing explanation of an error
   * @param {string|null} [data.detail] - What to do about it
   */
  constructor (data = {}) {
    const {
      label = 'Starting to convert the document',
      percentage = 0,
      isError = false,
      message = null,
      detail = null
    } = data

    this.pollUrl = POLL_URL
    // Where the poll goes once the save is complete: this page, which then
    // confirms the guide, so that happens in one place with or without
    // JavaScript.
    this.redirectUrl = CONVERTING_URL
    this.convertingUrl = CONVERTING_URL
    this.checkAnswersUrl = CHECK_ANSWERS_URL

    this.label = label
    this.percentage = percentage
    this.isError = isError
    this.errorMessage = isError ? message : null
    this.errorDetail = isError ? detail : null

    this.pageTitle = isError ? 'Error: Converting your document' : 'Converting your document'
  }

  page = 'converting'
}

export {
  ConvertingViewModel
}
