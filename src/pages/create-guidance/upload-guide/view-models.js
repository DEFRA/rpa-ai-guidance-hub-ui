import { CDP_UPLOADER_BROWSER_URL } from '../../../constants/uploader.js'

/**
 * View model for the upload guidance page
 */
class UploadGuidanceViewModel {
  /**
   * @param {Object} [data={}]
   * @param {string} data.uploadId - The upload id to build the browser URL
   */
  constructor (data = {}) {
    this.uploadUrl = `${CDP_UPLOADER_BROWSER_URL}/${data.uploadId}`
  }

  pageTitle = 'Upload a single guidance document'
  page = 'upload single guidance document'
}

/**
 * View model for the upload status page
 */
class UploadStatusViewModel {
  /**
   * @param {Object} [data={}]
   * @param {string} [data.uploadId] - The upload id
   * @param {string} [data.uploadStatus] - The current upload status (e.g. 'pending', 'ready')
   * @param {boolean} [data.isReady] - Whether upload and scanning is complete
   * @param {boolean} [data.hasRejectedFiles] - Whether any files were rejected
   * @param {Array<Object>} [data.files] - List of projected files
   * @param {string} [data.errorMessage] - Explicit error message if any
   */
  constructor (data = {}) {
    this.uploadId = data.uploadId ?? ''
    this.uploadStatus = data.uploadStatus ?? 'pending'
    this.isReady = Boolean(data.isReady)
    this.hasRejectedFiles = Boolean(data.hasRejectedFiles)
    this.files = data.files ?? []
    this.pollUrl = this.uploadId ? `/status-poll/${this.uploadId}` : '/status-poll'
    this.retryUrl = '/create-guidance/upload-guide'
    this.redirectUrl = '/create-guidance/metadata'

    const rejectedFile = this.files.find((f) => f.fileStatus === 'rejected' || f.error)
    const fileError = rejectedFile?.error?.message

    if (this.hasRejectedFiles || fileError || data.errorMessage) {
      this.isError = true
      this.errorMessage = data.errorMessage || fileError || 'The uploaded file failed verification checks'
      this.errorList = [{ text: this.errorMessage, href: '#upload-status-error' }]
      this.pageTitle = 'Error: Checking your document'
      this.pageHeading = 'There is a problem'
      this.statusMessage = this.errorMessage
      this.progressPercentage = 100
      this.refreshInterval = null
    } else if (this.isReady) {
      this.isError = false
      this.pageTitle = 'Checking your document'
      this.pageHeading = 'Checking your document'
      this.statusMessage = 'Your document has been verified. Redirecting...'
      this.progressPercentage = 100
      this.refreshInterval = null
    } else {
      this.isError = false
      this.pageTitle = 'Checking your document'
      this.pageHeading = 'Checking your document'
      this.statusMessage = 'We are scanning your document for viruses and checking its format. This should take a few seconds.'
      this.progressPercentage = 50
      this.refreshInterval = 2
    }
  }

  caption = 'Create guidance'
  page = 'upload-status'
}

export {
  UploadGuidanceViewModel,
  UploadStatusViewModel
}
