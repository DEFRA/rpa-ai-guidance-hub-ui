import { NONE_SCHEME_VALUE } from '../../../../services/reference-data.js'

const BACK_URL = '/create-guidance/upload-guide'
const NOT_AVAILABLE = 'Not available'

const FIELD_HREF_MAP = {
  guideTitle: '#guide-title',
  schemes: '#schemes'
}

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
   * @param {string|null} [data.notification]
   */
  constructor (data = {}) {
    const schemeOptions = (data.schemeOptions || []).map((option) => ({
      value: option.value,
      text: option.text || option.label,
      // "Not scheme-specific" is an opt-out choice rather than a real
      // scheme (see NONE_SCHEME_VALUE in services/reference-data.js, the
      // source of truth for which value that is) - the divider above it in
      // the checkbox list is purely a display concern, so it's added here.
      ...(option.value === NONE_SCHEME_VALUE ? { divider: 'or' } : {})
    }))

    this.values = data.values || {}
    this.errors = data.errors || {}
    this.errorList = data.errorList || []
    this.versionNumber = data.versionNumber || NOT_AVAILABLE
    this.lastModifiedDate = data.lastModifiedDate || NOT_AVAILABLE
    this.schemeOptions = schemeOptions
    this.backUrl = data.backUrl || BACK_URL
    this.notification = data.notification || null
  }

  /**
   * Create a view model from session data and reference schemes
   */
  static fromSession ({ values = {}, schemeOptions = [], notification = null } = {}) {
    return new GuideDetailsViewModel({
      values: {
        guideTitle: values.guideTitle ?? '',
        schemes: values.schemes ?? ''
      },
      versionNumber: values.versionNumber || NOT_AVAILABLE,
      lastModifiedDate: values.lastModifiedDate || NOT_AVAILABLE,
      schemeOptions,
      notification
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

      const href = FIELD_HREF_MAP[field] || `#${field}`

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
