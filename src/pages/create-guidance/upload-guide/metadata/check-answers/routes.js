import { requireRoles } from '../../../../../server/access-control/require-roles.js'
import { ROLES } from '../../../../../constants/roles.js'
import * as checkAnswersController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/metadata/check-answers',
    options: {
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'check your answers before creating a guide' }
    },
    handler: checkAnswersController.getCheckAnswers
  },
  {
    method: 'POST',
    path: '/create-guidance/upload-guide/metadata/check-answers',
    options: {
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'create a new guide' }
    },
    handler: checkAnswersController.convertDocument
  }
]

export {
  routes
}
