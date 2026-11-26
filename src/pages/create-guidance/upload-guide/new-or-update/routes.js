import Joi from 'joi'

import * as newOrUpdateController from './controller.js'

const CHOICE_URL = '/create-guidance/upload-guide/new-or-update'
const ROLE_REQUIRED_REASON = 'add a new guide or a new version of one'

const choiceSchema = Joi.object({
  kind: Joi.string().valid('new', 'update').required().messages({
    'any.required': 'Select whether this is a new guide or a new version of one',
    'any.only': 'Select whether this is a new guide or a new version of one'
  }),
  guideId: Joi.when('kind', {
    is: 'update',
    then: Joi.string().guid().required(),
    otherwise: Joi.any().strip()
  }).messages({
    'any.required': 'Select the guide this document updates',
    'string.guid': 'Select the guide this document updates'
  }),
  q: Joi.string().allow('').default('')
})

const routes = [
  {
    method: 'GET',
    path: CHOICE_URL,
    options: { app: { roleRequiredReason: ROLE_REQUIRED_REASON } },
    handler: newOrUpdateController.getChoicePage
  },
  {
    method: 'POST',
    path: CHOICE_URL,
    options: {
      app: { roleRequiredReason: ROLE_REQUIRED_REASON },
      validate: {
        payload: choiceSchema,
        failAction: newOrUpdateController.choiceFailAction
      }
    },
    handler: newOrUpdateController.postChoice
  }
]

export {
  routes
}
