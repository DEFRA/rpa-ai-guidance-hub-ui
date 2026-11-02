import { requireRoles } from '../../../../server/access-control/require-roles.js'
import { ROLES } from '../../../../constants/roles.js'
import { getConverted } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/converted',
    options: {
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'review a converted guide' }
    },
    handler: getConverted
  }
]

export {
  routes
}
