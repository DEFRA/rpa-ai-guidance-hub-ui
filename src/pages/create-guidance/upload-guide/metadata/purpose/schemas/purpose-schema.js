import Joi from 'joi'

const MAX_GOAL_LENGTH = 200

const OWNER_REQUIRED_MESSAGE = 'Enter an email address'
const OWNER_FORMAT_MESSAGE = 'Enter an email address in the correct format'
const GOAL_REQUIRED_MESSAGE = 'Enter what this guidance aims to achieve'
const GOAL_MAX_MESSAGE = 'Purpose must be 200 characters or fewer'
const REQUIREMENTS_REQUIRED_MESSAGE = 'Enter what users need to perform or understand'
const SYSTEMS_REQUIRED_MESSAGE = 'Select the systems this guidance uses'
const AUDIENCE_REQUIRED_MESSAGE = 'Select who this guidance is for'

/**
 * A required GOV.UK checkbox group whose valid values come from a reference
 * option list. `.single()` accepts the bare-string shape a single checked
 * box submits as; every failure mode maps to the one "select" message.
 *
 * @private
 * @param {Array<{value: string}>} options - Valid reference options
 * @param {string} message - User-facing error for any failure
 * @param {string} name - Option list name, for the empty-list error
 * @returns {Joi.ArraySchema}
 */
function _requiredSelection (options, message, name) {
  const values = options.map((option) => option.value)

  if (values.length === 0) {
    throw new Error(`No valid ${name} options provided`)
  }

  return Joi.array()
    .items(Joi.string().valid(...values))
    .single()
    .min(1)
    .required()
    .messages({
      'array.min': message,
      'any.required': message,
      'array.base': message,
      'any.only': message
    })
}

/**
 * Build the "Owner and purpose" form schema against the current system and
 * audience reference options.
 *
 * Like `buildMetadataSchema` on screen 1, valid checkbox values come from
 * the reference data service and can change without a deploy, so the
 * schema is built fresh per request.
 *
 * Keys are declared in the order the fields appear on the page: with the
 * server-wide `abortEarly: false`, Joi reports errors in key order, and the
 * error summary relies on that to list them in page order.
 *
 * @param {Object} options
 * @param {Array<{value: string}>} options.systemOptions - Valid system reference options
 * @param {Array<{value: string}>} options.audienceOptions - Valid audience reference options
 * @returns {Joi.ObjectSchema}
 */
function buildPurposeSchema ({ systemOptions, audienceOptions }) {
  return Joi.object({
    owner: Joi.string()
      .trim()
      .required()
      .email({ tlds: { allow: false } })
      .messages({
        'any.required': OWNER_REQUIRED_MESSAGE,
        'string.empty': OWNER_REQUIRED_MESSAGE,
        'string.email': OWNER_FORMAT_MESSAGE
      }),
    goal: Joi.string()
      .trim()
      // Browsers submit textarea line breaks as CRLF (two characters) while
      // the GOV.UK character count JS counts them as one - normalize so the
      // server-side limit agrees with what the designer was shown.
      .replace(/\r\n/g, '\n')
      .required()
      .max(MAX_GOAL_LENGTH)
      .messages({
        'any.required': GOAL_REQUIRED_MESSAGE,
        'string.empty': GOAL_REQUIRED_MESSAGE,
        'string.max': GOAL_MAX_MESSAGE
      }),
    requirements: Joi.string()
      .trim()
      .required()
      .messages({
        'any.required': REQUIREMENTS_REQUIRED_MESSAGE,
        'string.empty': REQUIREMENTS_REQUIRED_MESSAGE
      }),
    systems: _requiredSelection(systemOptions, SYSTEMS_REQUIRED_MESSAGE, 'system'),
    audience: _requiredSelection(audienceOptions, AUDIENCE_REQUIRED_MESSAGE, 'audience')
  })
}

export {
  MAX_GOAL_LENGTH,
  buildPurposeSchema
}
