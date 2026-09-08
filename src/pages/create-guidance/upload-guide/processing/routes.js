import * as processingController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/processing',
    handler: processingController.getStatusPage
  },
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/processing/status',
    handler: processingController.getStatus
  }
]

export {
  routes
}
