import {
  getRebuildSearchIndex,
  postRebuildSearchIndex
} from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/admin/search-index/rebuild',
    options: {
      app: { roleRequiredReason: 'manage the hub' }
    },
    handler: getRebuildSearchIndex
  },
  {
    method: 'POST',
    path: '/admin/search-index/rebuild',
    options: {
      app: { roleRequiredReason: 'manage the hub' }
    },
    handler: postRebuildSearchIndex
  }
]

export {
  routes
}
