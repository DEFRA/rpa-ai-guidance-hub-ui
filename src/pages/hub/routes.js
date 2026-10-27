import Boom from '@hapi/boom'
import Joi from 'joi'

import * as hubController from './controller.js'

// An unknown list is a page that doesn't exist, not a bad request.
function notFound () {
  throw Boom.notFound()
}

const routes = [
  {
    method: 'GET',
    path: '/hub',
    handler: hubController.getHubPage
  },
  {
    method: 'GET',
    path: '/hub/{list}',
    options: {
      validate: {
        params: Joi.object({ list: Joi.string().valid(...hubController.LIST_PATHS).required() }),
        failAction: notFound
      }
    },
    handler: hubController.getHubListPage
  }
]

export {
  routes
}
