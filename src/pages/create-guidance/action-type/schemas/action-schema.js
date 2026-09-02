import Joi from 'joi'

import { createActions } from '../constants.js'

const SELECT_ACTION_MESSAGE = 'Select an action'

const metadataSchema = Joi.object({
  action: Joi.string()
    .valid(...createActions)
    .required()
    .messages({
      'any.required': SELECT_ACTION_MESSAGE,
      'any.only': SELECT_ACTION_MESSAGE,
      'string.empty': SELECT_ACTION_MESSAGE
    })
})

export {
  metadataSchema
}
