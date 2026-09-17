import { mapValidationError } from '../../../form-errors.js'

const BACK_URL = '/create-guidance/upload-guide/metadata'

const FIELD_HREF_MAP = {
  owner: '#owner',
  goal: '#goal',
  requirements: '#requirements',
  systems: '#systems',
  audience: '#audience'
}

/**
 * Map reference options onto the `{value, text}` shape the checkbox
 * template renders
 *
 * @private
 * @param {Array<{value: string, label?: string, text?: string}>} [options]
 * @returns {Array<{value: string, text: string}>}
 */
function _toCheckboxOptions (options = []) {
  return options.map((option) => ({
    value: option.value,
    text: option.text || option.label
  }))
}

/**
 * OwnerAndPurposeViewModel - Form state and page data for screen 2 of
 * metadata capture
 */
class OwnerAndPurposeViewModel {
  /**
   * @param {Object} [data={}]
   * @param {Object} [data.values={}]
   * @param {Object} [data.errors={}]
   * @param {Array} [data.errorList=[]]
   * @param {Array} [data.systemOptions=[]]
   * @param {Array} [data.audienceOptions=[]]
   * @param {string|null} [data.backUrl]
   */
  constructor (data = {}) {
    this.values = data.values || {}
    this.errors = data.errors || {}
    this.errorList = data.errorList || []
    this.systemOptions = _toCheckboxOptions(data.systemOptions)
    this.audienceOptions = _toCheckboxOptions(data.audienceOptions)
    this.backUrl = data.backUrl || BACK_URL
  }

  /**
   * Create a view model from session metadata and reference options.
   *
   * Checkbox selections default to an empty array rather than an empty
   * string: the template tests membership with `indexOf`, which on a string
   * would do substring matching.
   */
  static fromSession ({ values = {}, systemOptions = [], audienceOptions = [] } = {}) {
    return new OwnerAndPurposeViewModel({
      values: {
        owner: values.owner ?? '',
        goal: values.goal ?? '',
        requirements: values.requirements ?? '',
        systems: values.systems ?? [],
        audience: values.audience ?? []
      },
      systemOptions,
      audienceOptions
    })
  }

  /**
   * Create a view model from a Joi validation error
   */
  static fromValidationError (payload, err, { systemOptions = [], audienceOptions = [] } = {}) {
    const { errors, errorList } = mapValidationError(err, FIELD_HREF_MAP)

    return new OwnerAndPurposeViewModel({
      values: payload,
      errors,
      errorList,
      systemOptions,
      audienceOptions
    })
  }

  pageTitle = 'Owner and purpose'
  page = 'upload-guide-metadata'
}

export {
  OwnerAndPurposeViewModel
}
