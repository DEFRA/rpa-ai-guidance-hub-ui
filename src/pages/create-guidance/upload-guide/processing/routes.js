import { requireRoles } from '../../../../server/access-control/require-roles.js'
import { ROLES } from '../../../../constants/roles.js'
import * as processingController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/processing',
    options: {
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'check the progress of an uploaded guide' }
    },
    handler: processingController.getStatusPage
  },
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/processing/status',
    options: {
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'check the progress of an uploaded guide' }
    },
    handler: processingController.getStatus
  }
]

export {
  routes
}
