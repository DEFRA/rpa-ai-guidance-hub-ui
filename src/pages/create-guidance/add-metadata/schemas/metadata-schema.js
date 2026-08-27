import Joi from 'joi'

const guidanceTypeValues = ['process', 'policy', 'how-to', 'reference']

const guidanceTypeOptions = [
  { value: 'process', text: 'Process' },
  { value: 'policy', text: 'Policy' },
  { value: 'how-to', text: 'How to' },
  { value: 'reference', text: 'Reference' }
]

/**
 * Reusable metadata schema for migration and future new-guidance creation.
 */
const metadataSchema = Joi.object({
  guidanceType: Joi.string()
    .valid(...guidanceTypeValues)
    .required()
    .messages({
      'any.required': 'Select the type of guidance',
      'any.only': 'Select the type of guidance',
      'string.empty': 'Select the type of guidance'
    }),
  title: Joi.string()
    .trim()
    .required()
    .max(200)
    .messages({
      'any.required': 'Enter the guidance title',
      'string.empty': 'Enter the guidance title',
      'string.max': 'Guidance title must be 200 characters or fewer'
    }),
  intendedAudience: Joi.string()
    .trim()
    .required()
    .max(2000)
    .messages({
      'any.required': 'Enter who this guidance is for',
      'string.empty': 'Enter who this guidance is for',
      'string.max':
        'Intended audience must be 2000 characters or fewer'
    }),
  intendedOutcome: Joi.string()
    .trim()
    .required()
    .max(2000)
    .messages({
      'any.required': 'Enter what this guidance aims to achieve',
      'string.empty': 'Enter what this guidance aims to achieve',
      'string.max':
        'Intended outcome must be 2000 characters or fewer'
    }),
  userPrerequisites: Joi.string()
    .trim()
    .required()
    .max(2000)
    .messages({
      'any.required':
        'Enter what users need to perform or understand',
      'string.empty':
        'Enter what users need to perform or understand',
      'string.max':
        'User prerequisites must be 2000 characters or fewer'
    }),
  requiresSystemAccess: Joi.string()
    .valid('yes', 'no')
    .required()
    .messages({
      'any.required':
        'Select whether users need access to any systems',
      'any.only':
        'Select whether users need access to any systems',
      'string.empty':
        'Select whether users need access to any systems'
    }),
  systemAccessDetails: Joi.when('requiresSystemAccess', {
    is: 'yes',
    then: Joi.string()
      .trim()
      .required()
      .max(2000)
      .messages({
        'any.required':
          'Enter which systems users need access to',
        'string.empty':
          'Enter which systems users need access to',
        'string.max':
          'System access details must be 2000 characters or fewer'
      }),
    otherwise: Joi.string()
      .allow('')
      .optional()
  })
})

export { metadataSchema, guidanceTypeOptions }
