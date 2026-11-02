import { requireRoles } from '../../../server/access-control/require-roles.js'
import { ROLES } from '../../../constants/roles.js'
import { getStartOver, postStartOver } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/start-over',
    options: {
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'upload a new guide' }
    },
    handler: getStartOver
  },
  {
    method: 'POST',
    path: '/create-guidance/start-over',
    options: {
      auth: requireRoles(ROLES.EDITOR),
      app: { roleRequiredReason: 'upload a new guide' }
    },
    handler: postStartOver
  }
]

export {
  routes
}
