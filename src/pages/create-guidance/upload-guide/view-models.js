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

export {
  UploadGuidanceViewModel
}
