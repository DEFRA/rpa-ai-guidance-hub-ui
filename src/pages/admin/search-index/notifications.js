const SEARCH_INDEX_URL = '/admin/search-index'

const SEARCH_INDEX_FLASH_KEY = 'searchIndexNotification'

/**
 * What the search index page says after an operation, by the key flashed to
 * it. Only a delete that worked offers the rebuild straight away.
 */
const SEARCH_INDEX_NOTIFICATIONS = {
  deleted: {
    type: 'success',
    text: 'Search index deleted. Search will show no results until you ' +
      'rebuild it.',
    offersRebuild: true
  },
  deleteFailed: {
    type: 'important',
    text: 'The search index could not be deleted. Try again.',
    offersRebuild: false
  },
  rebuildStarted: {
    type: 'success',
    text: 'The search index is being rebuilt. Guides will appear in search ' +
      'results over the next few minutes.',
    offersRebuild: false
  }
}

export {
  SEARCH_INDEX_URL,
  SEARCH_INDEX_FLASH_KEY,
  SEARCH_INDEX_NOTIFICATIONS
}
