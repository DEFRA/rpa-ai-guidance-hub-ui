import * as controller from './controller.js'

// Cookie consent routes. Public (no auth): the banner is rendered on signed-out
// pages too, so accept/reject and the settings page must work without a
// session. They only store the choice, so no user context is needed.
const routes = [
  {
    method: 'GET',
    path: '/cookies',
    options: { auth: false },
    handler: controller.cookiesGetController
  },
  {
    method: 'POST',
    path: '/cookies',
    options: { auth: false },
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
