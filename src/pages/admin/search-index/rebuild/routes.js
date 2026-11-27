import {
  getRebuildSearchIndex,
  postRebuildSearchIndex
} from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/admin/search-index/rebuild',
    options: {
      app: { roleRequiredReason: 'rebuild the search index' }
    },
    handler: getRebuildSearchIndex
  },
  {
    method: 'POST',
    path: '/admin/search-index/rebuild',
    options: {
      app: { roleRequiredReason: 'rebuild the search index' }
    },
    handler: postRebuildSearchIndex
  }
]

export {
  routes
}
