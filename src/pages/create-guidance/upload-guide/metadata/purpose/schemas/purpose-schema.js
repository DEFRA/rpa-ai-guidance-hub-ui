import Joi from 'joi'

const MAX_GOAL_LENGTH = 200

/**
 * What the owner and purpose form says of an answer it cannot take, named
 * once, so that one test holds their words and the rest name them.
 */
const PURPOSE_MESSAGES = Object.freeze({
  ownerRequired: 'Enter an email address',
  ownerFormat: 'Enter an email address in the correct format',
  goalRequired: 'Enter what this guidance aims to achieve',
  goalTooLong: 'Purpose must be 200 characters or fewer',
  requirementsRequired: 'Enter what users need to perform or understand',
  systemsRequired: 'Select the systems this guidance uses',
  audienceRequired: 'Select who this guidance is for'
})

/**
 * A required GOV.UK checkbox group whose valid values come from a reference
 * option list. `.single()` accepts the bare-string shape a single checked
 * box submits as; every failure mode maps to the one "select" message.
 *
 * @private
 * @param {Array<{label: string}>} options - Valid reference options
 * @param {string} message - User-facing error for any failure
 * @param {string} name - Option list name, for the empty-list error
 * @returns {Joi.ArraySchema}
 */
function _requiredSelection (options, message, name) {
  const labels = options.map((option) => option.label)

  if (labels.length === 0) {
    throw new Error(`No valid ${name} options provided`)
  }

  return Joi.array()
    .items(Joi.string().valid(...labels))
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
 * @param {Array<{label: string}>} options.systemOptions - Valid system options
 * @param {Array<{label: string}>} options.audienceOptions - Valid audience options
 * @returns {Joi.ObjectSchema}
 */
function buildPurposeSchema ({ systemOptions, audienceOptions }) {
  return Joi.object({
    owner: Joi.string()
      .trim()
      .required()
      .email({ tlds: { allow: false } })
      .messages({
        'any.required': PURPOSE_MESSAGES.ownerRequired,
        'string.empty': PURPOSE_MESSAGES.ownerRequired,
        'string.email': PURPOSE_MESSAGES.ownerFormat
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
        'any.required': PURPOSE_MESSAGES.goalRequired,
        'string.empty': PURPOSE_MESSAGES.goalRequired,
        'string.max': PURPOSE_MESSAGES.goalTooLong
      }),
    requirements: Joi.string()
      .trim()
      .required()
      .messages({
        'any.required': PURPOSE_MESSAGES.requirementsRequired,
        'string.empty': PURPOSE_MESSAGES.requirementsRequired
      }),
    systems: _requiredSelection(systemOptions, PURPOSE_MESSAGES.systemsRequired, 'system'),
    audience: _requiredSelection(audienceOptions, PURPOSE_MESSAGES.audienceRequired, 'audience')
  })
}

export {
  MAX_GOAL_LENGTH,
  PURPOSE_MESSAGES,
  buildPurposeSchema
}
