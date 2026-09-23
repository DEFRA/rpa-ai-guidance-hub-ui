import { mapValidationError } from '../../../form-errors.js'
import { toCheckboxOptions } from '../view-helpers.js'

const BACK_URL = '/create-guidance/upload-guide/metadata'
const FORM_ACTION = '/create-guidance/upload-guide/metadata/purpose'

const FIELD_HREF_MAP = {
  owner: '#owner',
  goal: '#goal',
  requirements: '#requirements',
  systems: '#systems',
  audience: '#audience'
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
   * @param {string|null} [data.formAction]
   */
  constructor (data = {}) {
    this.values = data.values || {}
    this.errors = data.errors || {}
    this.errorList = data.errorList || []
    this.systemOptions = toCheckboxOptions(data.systemOptions)
    this.audienceOptions = toCheckboxOptions(data.audienceOptions)
    this.backUrl = data.backUrl || BACK_URL
    this.formAction = data.formAction || FORM_ACTION
  }

  /**
   * Create a view model from session metadata and reference options.
   *
   * Checkbox selections default to an empty array rather than an empty
   * string: the template tests membership with `indexOf`, which on a string
   * would do substring matching.
   */
  static fromSession ({
    values = {},
    systemOptions = [],
    audienceOptions = [],
    backUrl = null,
    formAction = null
  } = {}) {
    return new OwnerAndPurposeViewModel({
      values: {
        owner: values.owner ?? '',
        goal: values.goal ?? '',
        requirements: values.requirements ?? '',
        systems: values.systems ?? [],
        audience: values.audience ?? []
      },
      systemOptions,
      audienceOptions,
      backUrl,
      formAction
    })
  }

  /**
   * Create a view model from a Joi validation error
   */
  static fromValidationError (
    payload,
    err,
    {
      systemOptions = [],
      audienceOptions = [],
      backUrl = null,
      formAction = null
    } = {}
  ) {
    const { errors, errorList } = mapValidationError(err, FIELD_HREF_MAP)

    return new OwnerAndPurposeViewModel({
      values: payload,
      errors,
      errorList,
      systemOptions,
      audienceOptions,
      backUrl,
      formAction
    })
  }

  pageTitle = 'Owner and purpose'
  page = 'upload-guide-metadata'
}

export {
  OwnerAndPurposeViewModel
}
