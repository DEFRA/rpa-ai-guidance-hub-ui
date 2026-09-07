import { STEPS } from '../steps.js'

/**
 * View model for the "Checking your file" upload processing page.
 */
class UploadProcessingViewModel {
  /**
   * Create the view model
   *
   * @param {Object} [data={}]
   * @param {string} [data.uploadId] - The active upload id, used to build the poll URL
   * @param {string} [data.label] - User-facing progress label
   * @param {number} [data.percentage] - Progress bar percentage (0-100)
   * @param {boolean} [data.isComplete] - Whether processing is complete
   * @param {boolean} [data.isError] - Whether processing encountered an error
   */
  constructor (data = {}) {
    this.pollUrl = data.uploadId
      ? `/status-poll/${data.uploadId}`
      : null

    this.redirectUrl = '/create-guidance/metadata'

    this.label = data.label ?? 'Checking your file'
    this.percentage = data.percentage ?? 0
    this.isComplete = data.isComplete ?? false
    this.isError = data.isError ?? false

    this.steps = STEPS
  }

  pageTitle = 'Checking your file'
  page = 'upload processing'
}

export {
  UploadProcessingViewModel
}
