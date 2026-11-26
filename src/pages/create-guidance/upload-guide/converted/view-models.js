/**
 * View model for the confirmation that a guide has been converted.
 */
class ConvertedViewModel {
  /**
   * @param {Object} data
   * @param {string} data.guideTitle - The title the user gave the guide
   * @param {boolean} data.isNewVersion - Whether it is a new version of a
   *   guide, which is live at once, rather than a new guide's draft
   */
  constructor ({ guideTitle, isNewVersion }) {
    this.guideTitle = guideTitle
    this.isNewVersion = isNewVersion
  }

  pageTitle = 'Guidance converted'
  page = 'upload-guide-converted'
}

export {
  ConvertedViewModel
}
