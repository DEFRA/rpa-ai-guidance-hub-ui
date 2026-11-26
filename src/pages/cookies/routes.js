import * as controller from './controller.js'

// Reads the session if there is one, but never requires it.
const pageAuth = {
  mode: 'try',
  strategy: 'session',
  access: { scope: false }
}

const routes = [
  {
    method: 'GET',
    path: '/cookies',
    options: { auth: pageAuth },
    handler: controller.cookiesGetController
  },
  {
    method: 'POST',
    path: '/cookies',
    options: { auth: pageAuth },
    handler: controller.cookiesPostController
  },
  {
    method: 'POST',
    path: '/cookies/accept',
    options: { auth: false },
    handler: controller.bannerAcceptController
  },
  {
    method: 'POST',
    path: '/cookies/reject',
    options: { auth: false },
    handler: controller.bannerRejectController
  }
]

export { routes }
