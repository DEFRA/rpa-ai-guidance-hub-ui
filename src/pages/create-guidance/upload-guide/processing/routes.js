import * as processingController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/processing',
    handler: processingController.getStatusPage
  }
]

export {
  routes
}
