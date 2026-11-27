import { statusCodes } from '../../../constants/status-codes.js'
import {
  SEARCH_INDEX_FLASH_KEY,
  SEARCH_INDEX_NOTIFICATIONS
} from './notifications.js'

const SEARCH_INDEX_VIEW = 'admin/search-index/page.njk'

/**
 * The index management page, with what the last operation said, once.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function getSearchIndex (request, h) {
  const [flashed] = request.yar.flash(SEARCH_INDEX_FLASH_KEY)
  const notification = SEARCH_INDEX_NOTIFICATIONS[flashed] ?? null

  return h
    .view(SEARCH_INDEX_VIEW, {
      pageTitle: 'Index management',
      page: 'index management',
      notification
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getSearchIndex
}
