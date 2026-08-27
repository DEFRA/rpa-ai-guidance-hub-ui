import Joi from 'joi'

const guidanceTypeValues = ['process', 'policy', 'how-to', 'reference']

const guidanceTypeOptions = [
  { value: 'process', text: 'Process' },
  { value: 'policy', text: 'Policy' },
  { value: 'how-to', text: 'How to' },
  { value: 'reference', text: 'Reference' }
]

const MAX_TITLE_LENGTH = 200
const MAX_LONG_TEXT_LENGTH = 2000

const SELECT_GUIDANCE_TYPE_MESSAGE = 'Select the type of guidance'
const SELECT_SYSTEM_ACCESS_MESSAGE =
  'Select whether users need access to any systems'

/**
 * Reusable metadata schema for migration and future new-guidance creation.
 */
const metadataSchema = Joi.object({
  guidanceType: Joi.string()
    .valid(...guidanceTypeValues)
    .required()
    .messages({
      'any.required': SELECT_GUIDANCE_TYPE_MESSAGE,
      'any.only': SELECT_GUIDANCE_TYPE_MESSAGE,
      'string.empty': SELECT_GUIDANCE_TYPE_MESSAGE
    }),
  title: Joi.string()
    .trim()
    .required()
    .max(MAX_TITLE_LENGTH)
    .messages({
      'any.required': 'Enter the guidance title',
      'string.empty': 'Enter the guidance title',
      'string.max': 'Guidance title must be 200 characters or fewer'
    }),
  intendedAudience: Joi.string()
    .trim()
    .required()
    .max(MAX_LONG_TEXT_LENGTH)
    .messages({
      'any.required': 'Enter who this guidance is for',
      'string.empty': 'Enter who this guidance is for',
      'string.max':
        'Intended audience must be 2000 characters or fewer'
    }),
  intendedOutcome: Joi.string()
    .trim()
    .required()
    .max(MAX_LONG_TEXT_LENGTH)
    .messages({
      'any.required': 'Enter what this guidance aims to achieve',
      'string.empty': 'Enter what this guidance aims to achieve',
      'string.max':
        'Intended outcome must be 2000 characters or fewer'
    }),
  userPrerequisites: Joi.string()
    .trim()
    .required()
    .max(MAX_LONG_TEXT_LENGTH)
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
      'any.required': SELECT_SYSTEM_ACCESS_MESSAGE,
      'any.only': SELECT_SYSTEM_ACCESS_MESSAGE,
      'string.empty': SELECT_SYSTEM_ACCESS_MESSAGE
    }),
  systemAccessDetails: Joi.when('requiresSystemAccess', {
    is: 'yes',
    then: Joi.string()
      .trim()
      .required()
      .max(MAX_LONG_TEXT_LENGTH)
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
