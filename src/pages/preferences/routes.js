import Boom from '@hapi/boom'
import Joi from 'joi'

import { CONTENTS_WIDTH } from '../guide/contents-width.js'
import { SIDE_NAV_WIDTH } from '../side-nav/width.js'
import * as preferencesController from './controller.js'

/**
 * @param {{min: number, max: number}} limits - In pixels
 * @returns {Joi.NumberSchema} A whole width within the limits
 */
function width (limits) {
  return Joi.number().integer().min(limits.min).max(limits.max)
}

const routes = [
  {
    method: 'POST',
    path: '/preferences',
    options: {
      validate: {
        payload: Joi.object({
          contentsWidth: width(CONTENTS_WIDTH),
          sideNavWidth: width(SIDE_NAV_WIDTH)
        }).min(1),
        failAction: () => { throw Boom.badRequest() }
      }
    },
    handler: preferencesController.postPreferences
  }
]

export {
  routes
}
