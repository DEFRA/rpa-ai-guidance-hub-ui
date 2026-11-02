import * as processingController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/processing',
    options: {
      app: { roleRequiredReason: 'check the progress of an uploaded guide' }
    },
    handler: processingController.getStatusPage
  },
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/processing/status',
    options: {
      app: { roleRequiredReason: 'check the progress of an uploaded guide' }
    },
    handler: processingController.getStatus
  }
]

export {
  routes
}
