import * as uploadGuideController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide',
    options: {
      app: { roleRequiredReason: 'upload a new guide' }
    },
    handler: uploadGuideController.getUploadForm
  }
]

export {
  routes
}
