import * as checkAnswersController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/metadata/check-answers',
    handler: checkAnswersController.getCheckAnswers
  }
]

export {
  routes
}
