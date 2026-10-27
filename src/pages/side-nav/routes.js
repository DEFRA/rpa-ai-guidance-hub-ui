import Boom from '@hapi/boom'
import Joi from 'joi'

import * as sideNavController from './controller.js'

const routes = [
  {
    method: 'POST',
    path: '/side-nav/toggle',
    options: {
      validate: {
        payload: Joi.object({
          collapsed: Joi.boolean().required(),
          returnTo: Joi.string().allow('').default('')
        }),
        failAction: () => { throw Boom.badRequest() }
      }
    },
    handler: sideNavController.postToggle
  }
]

export {
  routes
}
