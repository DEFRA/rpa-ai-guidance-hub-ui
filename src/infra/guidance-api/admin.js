import { statusCodes } from '../../constants/status-codes.js'
import { guidanceApiClient } from './client.js'

/**
 * Delete everything search holds. Search returns no results until the guides
 * are sent again.
 *
 * @param {string} requestedBy - The hub's id for the administrator
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - On 200 data
 *   is `{deletedObjects, deletedStateRecords}`; status 502 (data null) means
 *   search failed
 * @throws {GuidanceApiError} - On any other status that is not ok
 */
async function deleteSearchIndex (requestedBy) {
  return guidanceApiClient.request('/admin/search-index', {
    method: 'DELETE',
    headers: { 'x-requested-by': requestedBy },
    expected: [statusCodes.HTTP_STATUS_BAD_GATEWAY]
  })
}

/**
 * Send every guide to search again. The API answers at once and does the work
 * in the background.
 *
 * @param {string} requestedBy - The hub's id for the administrator
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {GuidanceApiError} - When response is not ok
 */
async function rebuildSearchIndex (requestedBy) {
  return guidanceApiClient.request('/admin/search-index/rebuild', {
    method: 'POST',
    body: { requestedBy }
  })
}

export {
  deleteSearchIndex,
  rebuildSearchIndex
}
