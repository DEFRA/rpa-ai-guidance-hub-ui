import * as registryController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/',
    options: {
      auth: false
    },
    handler: registryController.getHomepage
  }
]

export {
  routes
}
