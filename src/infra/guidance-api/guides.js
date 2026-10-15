import { statusCodes } from '../../constants/status-codes.js'
import { guidanceApiClient } from './client.js'

/**
 * Convert an upload into a guide, recording what its author said about it.
 *
 * Safe to repeat: the API answers the guide the same upload made before
 * (200) rather than making a second one.
 *
 * Waits as long as the conversion takes, which can be longer than the
 * client's timeout allows.
 *
 * @param {Object} newGuide
 * @param {{uploadId: string, fileId: string, filename: string}} newGuide.source
 * @param {Object} newGuide.metadata - The journey's answers
 * @param {{id: string, displayName: string}} [newGuide.createdBy]
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - not ok
 *   with 404 when the upload was never delivered or has expired, or 409
 *   when it has not finished parsing
 * @throws {GuidanceApiError} - When response is not ok and not a 404 or 409
 */
async function createGuide (newGuide) {
  return guidanceApiClient.request('/guides', {
    method: 'POST',
    body: newGuide,
    expected: [
      statusCodes.HTTP_STATUS_NOT_FOUND,
      statusCodes.HTTP_STATUS_CONFLICT
    ],
    timeout: null
  })
}

/**
 * List guides, newest first, a page at a time.
 *
 * Values within one filter match any of them; different filters must all
 * match.
 *
 * @param {Object} [filters]
 * @param {number} [filters.limit] - Page size, 1 to 100
 * @param {string} [filters.cursor] - The previous page's `nextCursor`
 * @param {string[]} [filters.schemes]
 * @param {string[]} [filters.systems]
 * @param {string[]} [filters.audiences]
 * @param {string[]} [filters.guidanceTypes]
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is
 *   `{ items, nextCursor }`
 * @throws {GuidanceApiError} - When response is not ok
 */
async function listGuides ({
  limit, cursor, schemes, systems, audiences, guidanceTypes
} = {}) {
  return guidanceApiClient.request('/guides', {
    query: {
      limit,
      cursor,
      scheme: schemes,
      system: systems,
      audience: audiences,
      guidance_type: guidanceTypes
    }
  })
}

/**
 * Get a guide with its versions, newest first.
 *
 * @param {string} guideId
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - not ok
 *   with 404 when there is no such guide
 * @throws {GuidanceApiError} - When response is not ok and not a 404
 */
async function getGuide (guideId) {
  return guidanceApiClient.request(_guidePath(guideId), {
    expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
  })
}

/**
 * Get the Markdown of a guide's latest version.
 *
 * @param {string} guideId
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is
 *   the Markdown string; not ok with 404 when there is no such guide or it
 *   has no versions
 * @throws {GuidanceApiError} - When response is not ok and not a 404, such
 *   as a 502 when the recorded content is missing
 */
async function getGuideContent (guideId) {
  return guidanceApiClient.request(`${_guidePath(guideId)}/content`, {
    expected: [statusCodes.HTTP_STATUS_NOT_FOUND],
    responseType: 'text'
  })
}

/**
 * Get an image from a guide's content.
 *
 * @param {string} guideId
 * @param {string} name - The asset's file name, as the content names it
 * @returns {Promise<{ok: boolean, status: number, data: any, headers:
 *   Headers}>} - data is a Buffer; not ok with 404 when there is no such
 *   asset
 * @throws {GuidanceApiError} - When response is not ok and not a 404
 */
async function getGuideAsset (guideId, name) {
  return guidanceApiClient.request(
    `${_guidePath(guideId)}/assets/${encodeURIComponent(name)}`,
    {
      expected: [statusCodes.HTTP_STATUS_NOT_FOUND],
      responseType: 'buffer'
    }
  )
}

/**
 * @private
 * @param {string} guideId
 * @returns {string} The guide's path
 */
function _guidePath (guideId) {
  return `/guides/${encodeURIComponent(guideId)}`
}

export {
  createGuide,
  getGuide,
  getGuideAsset,
  getGuideContent,
  listGuides
}
