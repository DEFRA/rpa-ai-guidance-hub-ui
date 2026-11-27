import {
  getDeleteSearchIndex,
  postDeleteSearchIndex
} from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/admin/search-index/delete',
    options: {
      app: { roleRequiredReason: 'delete the search index' }
    },
    handler: getDeleteSearchIndex
  },
  {
    method: 'POST',
    path: '/admin/search-index/delete',
    options: {
      app: { roleRequiredReason: 'delete the search index' }
    },
    handler: postDeleteSearchIndex
  }
]

export {
  routes
}
