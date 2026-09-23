import * as checkAnswersController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/metadata/check-answers',
    handler: checkAnswersController.getCheckAnswers
  },
  {
    method: 'POST',
    path: '/create-guidance/upload-guide/metadata/check-answers',
    handler: checkAnswersController.convertDocument
  }
]

export {
  routes
}
