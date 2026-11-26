import Joi from 'joi'

import { config } from '../../config/config.js'
import * as controller from './controller.js'

const isEntra = config.get('auth.provider') === 'entra'

const routes = [
  {
    method: 'GET',
    path: '/login',
    options: {
      auth: false
    },
    handler: isEntra ? controller.startEntraLogin : controller.loginAsDevUser
  },
  // The Entra redirect URI. Only exists for the 'entra' provider - the
  // 'local' provider signs in directly from `/login`. POST only: Entra sends
  // the code in a `form_post` body, so it never appears in a URL.
  ...(isEntra
    ? [{
        method: 'POST',
        path: '/login/callback',
        options: {
          auth: false,
          validate: {
            // What Entra posts: a code and state, or an error. Anything else
            // it sends (e.g. `session_state`) is stripped. A missing body
            // fails here, and is rejected and logged like any other bad
            // callback.
            payload: Joi.object({
              code: Joi.string(),
              state: Joi.string(),
              error: Joi.string(),
              error_description: Joi.string()
            }).options({ stripUnknown: true }),
            failAction: controller.rejectInvalidCallback
          }
        },
        handler: controller.handleEntraCallback
      }]
    : []),
  {
    method: 'GET',
    path: '/logout',
    options: {
      auth: {
        mode: 'try',
        strategy: 'session',
        // Users without Hub.Viewer must still be able to sign out
        access: { scope: false }
      }
    },
    handler: controller.logout
  }
]

export {
  routes
}
