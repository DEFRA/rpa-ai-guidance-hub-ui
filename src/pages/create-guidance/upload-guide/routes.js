import * as uploadGuideController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide',
    handler: uploadGuideController.getUploadForm
  }
]

export {
  routes
}
