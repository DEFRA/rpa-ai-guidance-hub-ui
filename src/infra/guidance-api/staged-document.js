import { statusCodes } from '../../constants/status-codes.js'
import { guidanceApiClient } from './client.js'

/**
 * Fetch a staged document's minimal-parse status by the file ID captured from
 * cdp-uploader.
 *
 * @param {string} fileId
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - `data` is
 *   `null` when no staged document has been claimed for this file ID yet (404)
 * @throws {GuidanceApiError} - When response is not ok and not a 404
 */
async function getStagedDocument (fileId) {
  return guidanceApiClient.request(
    `/guides/staged-document/${encodeURIComponent(fileId)}`,
    {
    expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
    }
  )
}

export {
  getStagedDocument
}
