import * as convertingController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/converting',
    handler: convertingController.getConvertingPage
  },
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/converting/status',
    handler: convertingController.getConvertingStatus
  }
]

export {
  routes
}
