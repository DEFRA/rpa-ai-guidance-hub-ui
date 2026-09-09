const BACK_URL = '/create-guidance/upload-guide'

/**
 * GuideDetailsViewModel - Form state and page data for screen 1 of metadata capture
 */
class GuideDetailsViewModel {
  /**
   * @param {Object} [data={}]
   * @param {Object} [data.values={}]
   * @param {Object} [data.errors={}]
   * @param {Array} [data.errorList=[]]
   * @param {string} [data.versionNumber='Not available']
   * @param {string} [data.lastModifiedDate='Not available']
   * @param {Array} [data.schemeOptions=[]]
   * @param {string|null} [data.backUrl]
   */
  constructor (data = {}) {
    this.values = data.values || {}
    this.errors = data.errors || {}
    this.errorList = data.errorList || []
    this.versionNumber = data.versionNumber || 'Not available'
    this.lastModifiedDate = data.lastModifiedDate || 'Not available'
    this.schemeOptions = data.schemeOptions || []
    this.backUrl = data.backUrl || BACK_URL
  }

  /**
   * Create a view model from session data and reference schemes
   */
  static fromSession ({ values = {}, schemeOptions = [] } = {}) {
    return new GuideDetailsViewModel({
      values: {
        guideTitle: values.guideTitle ?? '',
        schemes: values.schemes ?? ''
      },
      versionNumber: values.versionNumber || 'Not available',
      lastModifiedDate: values.lastModifiedDate || 'Not available',
      schemeOptions
    })
  }

  /**
   * Create a view model from Joi validation error
   */
  static fromValidationError (payload, err, { schemeOptions = [] } = {}) {
    const errors = {}
    const errorList = []

    for (const detail of err.details) {
      const field = detail.path[0]

      if (errors[field]) {
        continue
      }

      errors[field] = detail.message

      let href = `#${field}`
      if (field === 'guideTitle') {
        href = '#guide-title'
      } else if (field === 'schemes') {
        href = '#schemes'
      }

      errorList.push({
        text: detail.message,
        href
      })
    }

    return new GuideDetailsViewModel({
      values: payload,
      errors,
      errorList,
      schemeOptions
    })
  }

  pageTitle = "The guide's details"
  page = 'upload-guide-metadata'
}

export {
  GuideDetailsViewModel
}
