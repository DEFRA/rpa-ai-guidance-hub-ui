import Joi from 'joi'

const MAX_TITLE_LENGTH = 200

/**
 * Build the metadata form schema against a given set of valid scheme options.
 *
 * Valid scheme values come from the reference data service and can change
 * without a deploy, so they can't be baked into a schema built once at
 * import time - the schema has to be built fresh per request from whatever
 * options are current.
 *
 * @param {Array<{value: string}>} schemeOptions - Valid scheme reference options
 * @returns {Joi.ObjectSchema}
 */
function buildMetadataSchema (schemeOptions) {
  const schemeValues = schemeOptions.map((option) => option.value)

  console.log('Scheme values:', schemeValues)

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
        'array.min': 'Select at least one scheme this guidance relates to',
        'any.required': 'Select at least one scheme this guidance relates to',
        'array.base': 'Select at least one scheme this guidance relates to',
        'any.only': 'Select at least one scheme this guidance relates to'
      })
  })
}

export {
  buildMetadataSchema
}
