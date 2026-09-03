import { guidanceTypeOptions } from './schemas/metadata-schema.js'

/**
 * MigrateMetadataViewModel - Encapsulates form state for the metadata capture form
 * Handles both initial state and validation error states
 */
class MigrateMetadataViewModel {
  constructor (data) {
    this.guidanceTypeOptions = guidanceTypeOptions
    this.values = data?.values || {}
    this.errors = data?.errors || {}
    this.errorList = data?.errorList || []
    this.submissionError = data?.submissionError || null
    this.notification = data?.notification || null
  }

  /**
   * Create an empty form view model for initial GET
   */
  static empty () {
    return new MigrateMetadataViewModel()
  }

  /**
   * Create a form view model from saved session data
   */
  static fromSession (notification, savedMetadata = {}) {
    return new MigrateMetadataViewModel({
      values: savedMetadata,
      notification
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

      let href = `#${field}`
      if (field === 'requiresSystemAccess') {
        href = '#requiresSystemAccess-yes'
      }

      errorList.push({
        text: detail.message,
        href
      })
    }

    return new MigrateMetadataViewModel({
      values: payload,
      errors,
      errorList
    })
  }

  /**
   * Create a form view model from a submission error
   */
  static fromSubmissionError (payload, message) {
    return new MigrateMetadataViewModel({
      values: payload,
      submissionError: message
    })
  }

  pageTitle = 'Capture guidance metadata'
  page = 'designer'
}

export {
  MigrateMetadataViewModel
}
