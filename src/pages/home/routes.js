import * as registryController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/',
    handler: registryController.getHomepage
  }
]

export {
  routes
}
