import { getSearchIndex } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/admin/search-index',
    options: {
      app: { roleRequiredReason: 'manage the hub' }
    },
    handler: getSearchIndex
  }
]

export {
  routes
}
