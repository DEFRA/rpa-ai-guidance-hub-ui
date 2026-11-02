import * as controller from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/access-denied',
    options: {
      auth: { strategy: 'session', access: { scope: false } }
    },
    handler: controller.getAccessDenied
  },
  {
    method: 'GET',
    path: '/access-denied/role-required',
    options: {
      auth: { strategy: 'session', access: { scope: false } }
    },
    handler: controller.getRoleRequired
  }
]

export { routes }
