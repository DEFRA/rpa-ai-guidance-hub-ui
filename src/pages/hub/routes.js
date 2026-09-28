import * as hubController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/hub',
    handler: hubController.getHubPage
  }
]

export {
  routes
}
