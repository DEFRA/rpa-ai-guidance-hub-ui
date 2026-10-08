import { statusCodes } from '../../constants/status-codes.js'
import { guidanceApiClient } from './client.js'

/**
 * Convert an upload into a guide, recording what its author said about it.
 *
 * The API answers at once (202) and saves the guide in the background; the
 * staging record of the file says how far it has got. Safe to repeat: the
 * API answers the guide the same upload made before (200), and a save
 * under way is followed rather than started again.
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
    ]
  })
}

export {
  createGuide
}
