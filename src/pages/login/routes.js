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
  // 'local' provider signs in directly from `/login`.
  ...(isEntra
    ? [{
        method: ['GET', 'POST'],
        path: '/login/callback',
        options: {
          auth: false
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
