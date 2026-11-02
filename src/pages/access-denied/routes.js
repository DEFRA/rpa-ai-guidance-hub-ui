import * as controller from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/access-denied',
    options: {
      // Needs a session, but not Hub.Viewer: it is where users without it go
      auth: { strategy: 'session', access: { scope: false } }
    },
    handler: controller.getAccessDenied
  }
]

export { routes }
