import Boom from '@hapi/boom'
import Joi from 'joi'

import * as pinsController from './controller.js'

const guideId = Joi.string().uuid().required()
const position = Joi.number().integer().min(0)
const returnTo = Joi.string().allow('').default('')

// The pins change through forms, so that they change without JavaScript; the
// handlers build the change for the API.
const routes = [
  {
    method: 'POST',
    path: '/pin-toggle',
    options: {
      validate: {
        payload: Joi.object({
          guideId,
          pin: Joi.boolean().required(),
          position: position.when('pin', { is: false, then: Joi.required() }),
          returnTo,
          // The guide's star, to come back to: letters, digits and hyphens.
          anchor: Joi.string().max(64).pattern(/^[A-Za-z0-9-]+$/)
        }),
        failAction: () => { throw Boom.badRequest() }
      }
    },
    handler: pinsController.postPinToggle
  },
  {
    method: 'POST',
    path: '/pin-order',
    options: {
      validate: {
        payload: Joi.object({
          // The pinned guides as the page showed them: one id, or several.
          order: Joi.array().items(Joi.string().uuid()).single().min(1).required(),
          from: position.required(),
          to: position.required(),
          returnTo
        }),
        failAction: () => { throw Boom.badRequest() }
      }
    },
    handler: pinsController.postPinOrder
  }
]

export {
  routes
}
