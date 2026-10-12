/**
 * View model for the confirmation that a guide has been converted.
 */
class ConvertedViewModel {
  /**
   * @param {Object} data
   * @param {string} data.guideTitle - The title the user gave the guide
   */
  constructor ({ guideTitle }) {
    this.guideTitle = guideTitle
  }

  pageTitle = 'Guidance converted'
  page = 'upload-guide-converted'
}

export {
  ConvertedViewModel
}
