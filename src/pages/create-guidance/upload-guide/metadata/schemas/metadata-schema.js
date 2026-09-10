import Joi from 'joi'

const MAX_TITLE_LENGTH = 200
const SCHEME_REQUIRED_MESSAGE = 'Select at least one scheme this guidance relates to'

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
 * @param {Array<{value: string}>} schemeOptions - Valid scheme reference options
 * @returns {Joi.ObjectSchema}
 */
function buildMetadataSchema (schemeOptions) {
  const schemeValues = schemeOptions.map((option) => option.value)

  if (schemeValues.length === 0) {
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
    schemes: Joi.array()
      .items(Joi.string().valid(...schemeValues))
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
