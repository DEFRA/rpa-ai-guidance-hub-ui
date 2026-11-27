import { statusCodes } from '../../../../constants/status-codes.js'
import { rebuildSearchIndex } from '../../../../infra/guidance-api/admin.js'
import { userIdOf } from '../../../../services/users.js'
import {
  SEARCH_INDEX_FLASH_KEY,
  SEARCH_INDEX_URL
} from '../notifications.js'

const REBUILD_VIEW = 'admin/search-index/rebuild/page.njk'

/**
 * Ask the administrator to confirm before every guide is sent to search.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function getRebuildSearchIndex (_request, h) {
  return h
    .view(REBUILD_VIEW, {
      pageTitle: 'Rebuild the search index',
      page: 'rebuild search index'
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Ask the API to send every guide to search again, then go back to the page
 * to say so. The API does the work in the background.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 * @throws {GuidanceApiError} When the API does not accept the request
 */
async function postRebuildSearchIndex (request, h) {
  await rebuildSearchIndex(await userIdOf(request))

  request.yar.flash(SEARCH_INDEX_FLASH_KEY, 'rebuildStarted')

  return h.redirect(SEARCH_INDEX_URL)
}

export {
  getRebuildSearchIndex,
  postRebuildSearchIndex
}
