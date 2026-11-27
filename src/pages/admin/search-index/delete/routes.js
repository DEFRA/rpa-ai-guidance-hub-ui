import {
  getDeleteSearchIndex,
  postDeleteSearchIndex
} from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/admin/search-index/delete',
    options: {
      app: { roleRequiredReason: 'manage the hub' }
    },
    handler: getDeleteSearchIndex
  },
  {
    method: 'POST',
    path: '/admin/search-index/delete',
    options: {
      app: { roleRequiredReason: 'manage the hub' }
    },
    handler: postDeleteSearchIndex
  }
]

export {
  routes
}
