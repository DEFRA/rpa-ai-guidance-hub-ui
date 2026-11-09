import * as convertingController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/converting',
    options: {
      app: { roleRequiredReason: 'check the progress of a guide being converted' }
    },
    handler: convertingController.getConvertingPage
  },
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/converting/status',
    options: {
      app: { roleRequiredReason: 'check the progress of a guide being converted' }
    },
    handler: convertingController.getConvertingStatus
  }
]

export {
  routes
}
