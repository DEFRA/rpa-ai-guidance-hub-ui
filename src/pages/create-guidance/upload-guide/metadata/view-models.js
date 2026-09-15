import { format, isValid, parseISO } from 'date-fns'

import { NONE_SCHEME_VALUE } from '../../../../services/reference-data.js'

const BACK_URL = '/create-guidance/upload-guide'
const NOT_AVAILABLE = 'Not available'
const DATE_FORMAT = 'd MMMM yyyy'

const FIELD_HREF_MAP = {
  guideTitle: '#guide-title',
  schemes: '#schemes'
}

/**
 * Format a staged document's raw (ISO) lastModified timestamp for display.
 *
 * @param {string|null|undefined} dateString
 * @returns {string|null} - Formatted date, or null when missing/unparseable
 *   so callers can fall back to their own default
 */
function formatStagedDocumentDate (dateString) {
  if (!dateString) {
    return null
  }

  const parsed = parseISO(dateString)

  return isValid(parsed) ? format(parsed, DATE_FORMAT) : null
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
   *
   * When a staged document's minimal-parse items are supplied, they are used to
   * populate the title, version and last modified date - but a title the
   * user has already saved to session (`values.guideTitle`) always takes
   * precedence over the parsed staged document title, since it reflects a
   * deliberate
   * user edit.
   *
   * @param {Object} [options]
   * @param {Object} [options.values={}] - Session-saved metadata
   * @param {Object|null} [options.stagedDocument=null] - Minimal-parse staged
   *   document status, see StagedDocumentStatusModel in
   *   services/staged-document.js
   * @param {Array} [options.schemeOptions=[]]
   * @param {string|null} [options.notification=null]
   */
  static fromSession ({
    values = {},
    stagedDocument = null,
    schemeOptions = [],
    notification = null
  } = {}) {
    return new GuideDetailsViewModel({
      values: {
        guideTitle: values.guideTitle ?? stagedDocument?.title ?? '',
        schemes: values.schemes ?? ''
      },
      versionNumber:
        values.versionNumber || stagedDocument?.version || NOT_AVAILABLE,
      lastModifiedDate:
        values.lastModifiedDate ||
        formatStagedDocumentDate(stagedDocument?.lastModified) ||
        NOT_AVAILABLE,
      schemeOptions,
      notification
    })
  }

  /**
   * Create a view model from Joi validation error
   *
   * @param {Object} payload - Submitted form values to redisplay
   * @param {Object} err - Joi validation error
   * @param {Object} [options]
   * @param {Array} [options.schemeOptions=[]]
   * @param {Object|null} [options.stagedDocument=null] - Minimal-parse staged
   *   document status, used to keep the version/last modified summary
   *   populated when redisplaying the form after a validation failure
   */
  static fromValidationError (
    payload,
    err,
    { schemeOptions = [], stagedDocument = null } = {}
  ) {
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
      versionNumber: stagedDocument?.version || NOT_AVAILABLE,
      lastModifiedDate:
        formatStagedDocumentDate(stagedDocument?.lastModified) ||
        NOT_AVAILABLE,
      schemeOptions
    })
  }

  pageTitle = "The guide's details"
  page = 'upload-guide-metadata'
}

export {
  GuideDetailsViewModel
}
