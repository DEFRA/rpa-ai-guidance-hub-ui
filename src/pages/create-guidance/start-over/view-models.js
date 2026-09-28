/**
 * View model for the "start over" confirmation page.
 */
class StartOverViewModel {
  /**
   * @param {Object} [data={}]
   * @param {string} data.cancelUrl - Where "Cancel"/"Back" should return to
   * @param {Object} [data.guideDetailsCard] - Same shape as
   *   CheckAnswersViewModel's, reused so this page shows exactly what
   *   check-answers would have shown - including the uploaded file's own
   *   version/last modified date
   * @param {Object} [data.ownerPurposeCard]
   */
  constructor (data = {}) {
    this.cancelUrl = data.cancelUrl
    this.guideDetailsCard = data.guideDetailsCard || null
    this.ownerPurposeCard = data.ownerPurposeCard || null
  }

  pageTitle = 'Start over'
  page = 'start over'
}

export {
  StartOverViewModel
}
