import Boom from '@hapi/boom'
import Joi from 'joi'

import * as pinsController from './controller.js'

// The pins change through forms, so that they change without JavaScript; the
// handlers build the change for the API.
const routes = [
  {
    method: 'POST',
    path: '/pin-toggle',
    options: {
      validate: {
        payload: Joi.object({
          guideId: Joi.string().uuid().required(),
          pin: Joi.boolean().required(),
          position: Joi.number().integer().min(0).when('pin', { is: false, then: Joi.required() }),
          returnTo: Joi.string().allow('').default(''),
          // The guide's star, to come back to: letters, digits and hyphens.
          anchor: Joi.string().max(64).pattern(/^[A-Za-z0-9-]+$/)
        }),
        failAction: () => { throw Boom.badRequest() }
      }
    },
    handler: pinsController.postPinToggle
  }
]

export {
  routes
}
