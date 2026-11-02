import * as controller from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/access-denied',
    options: {
      auth: { strategy: 'session', access: { scope: false } }
    },
    handler: controller.getAccessDenied
  }
]

export { routes }
