import { statusCodes } from '../../../../constants/status-codes.js'
import { deleteSearchIndex } from '../../../../infra/guidance-api/admin.js'
import { userIdOf } from '../../../../services/users.js'
import {
  SEARCH_INDEX_FLASH_KEY,
  SEARCH_INDEX_URL
} from '../notifications.js'

const DELETE_VIEW = 'admin/search-index/delete/page.njk'

/**
 * Ask the administrator to confirm before the search index is deleted.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function getDeleteSearchIndex (_request, h) {
  return h
    .view(DELETE_VIEW, {
      pageTitle: 'Delete the search index',
      page: 'delete search index'
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Have the API delete the search index, then go back to the page to say
 * whether it worked.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 * @throws {GuidanceApiError} When the API fails in any way but search failing
 */
async function postDeleteSearchIndex (request, h) {
  const res = await deleteSearchIndex(await userIdOf(request))

  if (res.status === statusCodes.HTTP_STATUS_BAD_GATEWAY) {
    request.yar.flash(SEARCH_INDEX_FLASH_KEY, 'deleteFailed')

    return h.redirect(SEARCH_INDEX_URL)
  }

  request.yar.flash(SEARCH_INDEX_FLASH_KEY, 'deleted')

  return h.redirect(SEARCH_INDEX_URL)
}

export {
  getDeleteSearchIndex,
  postDeleteSearchIndex
}
