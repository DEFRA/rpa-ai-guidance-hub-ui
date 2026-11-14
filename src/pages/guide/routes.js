import Boom from '@hapi/boom'
import Joi from 'joi'

import * as guideController from './controller.js'
import { GUIDE_FORMATS } from './format.js'
import { READING_WIDTHS } from './reading-width.js'

// A malformed address is a guide that doesn't exist, not a bad request.
function notFound () {
  throw Boom.notFound()
}

const guideIdSchema = Joi.string().uuid().required()

const routes = [
  {
    method: 'GET',
    path: '/guides/{guideId}',
    options: {
      validate: {
        params: Joi.object({ guideId: guideIdSchema }),
        failAction: notFound
      }
    },
    handler: guideController.getGuidePage
  },
  {
    method: 'POST',
    path: '/guides/reading-width',
    options: {
      validate: {
        payload: Joi.object({
          width: Joi.string().valid(...READING_WIDTHS.map(option => option.value)).required(),
          returnTo: Joi.string().allow('').default('')
        }),
        failAction: () => { throw Boom.badRequest() }
      }
    },
    handler: guideController.postReadingWidth
  },
  {
    method: 'POST',
    path: '/guides/format',
    options: {
      validate: {
        payload: Joi.object({
          format: Joi.string().valid(...GUIDE_FORMATS.map(option => option.value)).required(),
          returnTo: Joi.string().allow('').default('')
        }),
        failAction: () => { throw Boom.badRequest() }
      }
    },
    handler: guideController.postFormat
  },
  {
    method: 'POST',
    path: '/guides/information',
    options: {
      validate: {
        payload: Joi.object({
          shown: Joi.boolean().required(),
          returnTo: Joi.string().allow('').default('')
        }),
        failAction: () => { throw Boom.badRequest() }
      }
    },
    handler: guideController.postInformation
  },
  {
    method: 'GET',
    path: '/guides/{guideId}/assets/{name}',
    options: {
      validate: {
        params: Joi.object({
          guideId: guideIdSchema,
          name: Joi.string().pattern(/^[A-Za-z0-9]+\.[A-Za-z0-9]+$/).required()
        }),
        failAction: notFound
      }
    },
    handler: guideController.getGuideAsset
  }
]

export {
  routes
}
