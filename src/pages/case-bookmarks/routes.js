import Boom from '@hapi/boom'
import Joi from 'joi'

import * as caseBookmarksController from './controller.js'

function badRequest () {
  throw Boom.badRequest()
}

const key = Joi.string().uuid().required()
const position = Joi.number().integer().min(0)
// Ids as the page showed them, in order: one, or several.
const order = Joi.array().items(Joi.string().uuid()).single().min(1).required()
const returnTo = Joi.string().allow('')

// The case bookmarks change through forms, so that they change without
// JavaScript, or from the side navigation's dragging; the handlers build the
// change for the API. A case is named by its key, never its reference.
const routes = [
  {
    method: 'POST',
    path: '/case-bookmarks/remove',
    options: {
      validate: {
        // A case; or, with a guide, that guide; or, with a section too, that
        // section.
        payload: Joi.object({
          key,
          guideId: Joi.string().uuid(),
          sectionId: Joi.string().uuid().when('guideId', { is: Joi.exist(), otherwise: Joi.forbidden() }),
          returnTo
        }),
        failAction: badRequest
      }
    },
    handler: caseBookmarksController.postRemove
  },
  {
    method: 'POST',
    path: '/case-bookmarks/order',
    options: {
      validate: {
        payload: Joi.object({ order, from: position.required(), to: position.required(), returnTo }),
        failAction: badRequest
      }
    },
    handler: caseBookmarksController.postCaseOrder
  },
  {
    method: 'POST',
    path: '/case-bookmarks/guide-order',
    options: {
      validate: {
        payload: Joi.object({ key, order, from: position.required(), to: position.required(), returnTo }),
        failAction: badRequest
      }
    },
    handler: caseBookmarksController.postGuideOrder
  }
]

export {
  routes
}
