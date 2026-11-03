import Joi from 'joi'

const MAX_TITLE_LENGTH = 200
const SCHEME_REQUIRED_MESSAGE = 'Select at least one scheme this guidance relates to'
const VERSION_NUMBER_REQUIRED_MESSAGE = 'Enter the version number'
const VERSION_NUMBER_FORMAT_MESSAGE =
  'Enter the version number as 2 whole numbers with a full stop between them, for example 1.0'

// ASCII digits only: a version number is typed as SharePoint shows it.
const DIGITS = '0123456789'

/**
 * @param {string} text
 * @returns {boolean} Whether `text` is a whole number written in digits alone
 */
function _isWholeNumber (text) {
  return text.length > 0 && [...text].every((character) => DIGITS.includes(character))
}

/**
 * A version number as SharePoint numbers a version of a Word document: two
 * whole numbers with a full stop between them (`major.minor`), such as `1.0`
 * or `12.3`. Checked with plain code rather than a regular expression.
 *
 * @param {string} value - Already trimmed
 * @param {import('joi').CustomHelpers} helpers
 * @returns {string|import('joi').ErrorReport}
 */
function _majorMinor (value, helpers) {
  const [major, minor, ...rest] = value.split('.')
  const isMajorMinor = rest.length === 0 && minor !== undefined && _isWholeNumber(major) && _isWholeNumber(minor)

  return isMajorMinor ? value : helpers.error('string.majorMinor')
}

/**
 * Build the metadata form schema against a given set of valid scheme options.
 *
 * Valid scheme values come from the reference data service and can change
 * without a deploy, so they can't be baked into a schema built once at
 * import time - the schema has to be built fresh per request from whatever
 * options are current. `schemeOptions` is expected to already include the
 * "None" opt-out choice (see `getSchemes` in services/reference-data.js) -
 * this schema just trusts whatever valid values it's given, same as any
 * other scheme.
 *
 * @param {Array<{label: string}>} schemeOptions - Valid scheme options
 * @returns {Joi.ObjectSchema}
 */
function buildMetadataSchema (schemeOptions) {
  const schemeLabels = schemeOptions.map((option) => option.label)

  if (schemeLabels.length === 0) {
    throw new Error('No valid scheme options provided')
  }

  return Joi.object({
    guideTitle: Joi.string()
      .trim()
      .required()
      .max(MAX_TITLE_LENGTH)
      .messages({
        'any.required': 'Enter the guidance title',
        'string.empty': 'Enter the guidance title',
        'string.max': 'Guidance title must be 200 characters or fewer'
      }),
    versionNumber: Joi.string()
      .trim()
      .required()
      .custom(_majorMinor)
      .messages({
        'any.required': VERSION_NUMBER_REQUIRED_MESSAGE,
        'string.empty': VERSION_NUMBER_REQUIRED_MESSAGE,
        'string.majorMinor': VERSION_NUMBER_FORMAT_MESSAGE
      }),
    schemes: Joi.array()
      .items(Joi.string().valid(...schemeLabels))
      .single()
      .min(1)
      .required()
      .messages({
        'array.min': SCHEME_REQUIRED_MESSAGE,
        'any.required': SCHEME_REQUIRED_MESSAGE,
        'array.base': SCHEME_REQUIRED_MESSAGE,
        'any.only': SCHEME_REQUIRED_MESSAGE
      })
  })
}

export {
  buildMetadataSchema
}
