import { createActions } from './constants.js'

class ActionTypeViewModel {
  /**
   * Construct the ActionTypeViewModel.
   *
   * @param {Object} [data={}] - Initial values for the view model
   * @param {Object} [data.values] - Initial form values
   * @param {Object} [data.errors] - Field-level error map
   * @param {Array} [data.errorList] - Ordered error list for summary
   * @param {string} [data.submissionError] - General submission error message
   */
  constructor (data = {}) {
    this.values = data.values || {}
    this.errors = data.errors || {}
    this.errorList = data.errorList || []
    this.submissionError = data.submissionError

    // Build radio options from constants
    this.actionOptions = createActions.map((a) => ({
      value: a,
      text: this._optionText(a)
    }))
  }

  /**
   * Map an internal action key to a user-facing label.
   *
   * @private
   * @param {string} action - Action key
   * @returns {string} Human-friendly label for the radio option
   */
  _optionText (action) {
    // Map action keys to human-friendly labels
    const map = {
      migrate: 'Migrate an existing guide'
    }

    return map[action] || action
  }

  /**
   * Create an empty form view model for initial GET
   */
  static empty () {
    return new ActionTypeViewModel()
  }

  /**
   * Create a form view model from saved session data
   */
  static fromSession (savedMetadata = {}) {
    return new ActionTypeViewModel({
      values: savedMetadata
    })
  }

  /**
   * Create a form view model from a validation error
   * Extracts Joi error details into structured errors and errorList
   */
  static fromValidationError (payload, err) {
    const errors = {}
    const errorList = []

    for (const detail of err.details) {
      const field = detail.path[0]

      if (errors[field]) {
        continue
      }

      errors[field] = detail.message

      const href = `#${field}`

      errorList.push({
        text: detail.message,
        href
      })
    }

    return new ActionTypeViewModel({
      values: payload,
      errors,
      errorList
    })
  }

  /**
   * Create a form view model from a submission error
   */
  static fromSubmissionError (payload, message) {
    return new ActionTypeViewModel({
      values: payload,
      submissionError: message
    })
  }

  pageTitle = 'Choose an action'
  page = 'action chooser'
}

export {
  ActionTypeViewModel
}
