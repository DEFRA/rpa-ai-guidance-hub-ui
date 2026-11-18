import Boom from '@hapi/boom'
import Joi from 'joi'

import { statusCodes } from '../../../constants/status-codes.js'
import * as bookmarkController from './controller.js'

// A malformed address is a guide that doesn't exist, not a bad request.
function notFound () {
  throw Boom.notFound()
}

const params = Joi.object({ guideId: Joi.string().uuid().required() })

const routes = [
  {
    method: 'GET',
    path: '/guides/{guideId}/bookmark',
    options: {
      validate: {
        params,
        query: Joi.object({ section: Joi.string().allow('') }).unknown(true),
        failAction: notFound
      }
    },
    handler: bookmarkController.getBookmarkPage
  },
  {
    method: 'POST',
    path: '/guides/{guideId}/bookmark',
    options: {
      validate: {
        params,
        payload: Joi.object({
          section: Joi.string().allow(''),
          choice: Joi.string().allow(''),
          existingCase: Joi.string().allow(''),
          newCase: Joi.string().allow(''),
          existingSbi: Joi.string().allow(''),
          newSbi: Joi.string().allow(''),
          // The keys of the cases the page offered, in their order.
          shown: Joi.array().items(Joi.string().uuid()).single().default([])
        }),
        failAction: (_request, h) => h.response().code(statusCodes.HTTP_STATUS_BAD_REQUEST).takeover()
      }
    },
    handler: bookmarkController.postBookmark
  }
]

export {
  routes
}
