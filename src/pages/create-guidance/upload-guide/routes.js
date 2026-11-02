import { requireRoles } from '../../../server/access-control/require-roles.js'
import { ROLES } from '../../../constants/roles.js'
import * as uploadGuideController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide',
    options: {
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'upload a new guide' }
    },
    handler: uploadGuideController.getUploadForm
  }
]

export {
  routes
}
