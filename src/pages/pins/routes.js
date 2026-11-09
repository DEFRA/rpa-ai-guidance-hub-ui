import Boom from '@hapi/boom'
import Joi from 'joi'

import { idsOfPinKey } from '../../services/users.js'
import * as pinsController from './controller.js'

const id = Joi.string().uuid()
const guideId = id.required()
const position = Joi.number().integer().min(0)
const returnTo = Joi.string().allow('').default('')

// A pin as a page names it: its guide's id, then its section's for a section.
const pinKey = Joi.string().custom((value, helpers) => {
  const ids = idsOfPinKey(value)

  return ids.length <= 2 && ids.every(part => !id.validate(part).error) ? value : helpers.error('any.invalid')
})

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
          // A section of the guide: by its id, to unpin it; by its anchor, to
          // pin it.
          sectionId: id,
          section: Joi.string(),
          returnTo,
          // Where on the page to come back to, the star or the heading: as a
          // heading's anchor is made, letters, digits, `_` and hyphens.
          anchor: Joi.string().pattern(/^[\p{L}\p{M}\p{N}\p{Pc}-]+$/u)
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
          // The pins as the page showed them: one key, or several.
          order: Joi.array().items(pinKey).single().min(1).required(),
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
