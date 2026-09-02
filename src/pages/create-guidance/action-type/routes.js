import * as actionTypeController from './controller.js'
import { metadataSchema } from './schemas/action-schema.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/action-type',
    handler: actionTypeController.getActionForm
  },
  {
    method: 'POST',
    path: '/create-guidance/action-type',
    options: {
      validate: {
        payload: metadataSchema,
        failAction: actionTypeController.postActionFailAction
      }
    },
    handler: actionTypeController.postAction
  }
]

export {
  routes
}
