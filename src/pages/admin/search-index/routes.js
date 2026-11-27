import { getSearchIndex } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/admin/search-index',
    options: {
      app: { roleRequiredReason: 'manage the search index' }
    },
    handler: getSearchIndex
  }
]

export {
  routes
}
