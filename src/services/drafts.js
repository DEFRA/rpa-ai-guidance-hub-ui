import { statusCodes } from '../constants/status-codes.js'
import * as draftsApi from '../infra/guidance-api/drafts.js'

/**
 * Projected draft status model exposed to application code.
 *
 * @typedef {Object} DraftStatusModel
 * @property {string} fileId
 * @property {string} parsingStatus - 'pending' | 'in_progress' | 'complete' | 'failed'
 * @property {string|null} [parsingError]
 * @property {string|null} [title]
 * @property {string|null} [version]
 * @property {string|null} [lastModified]
 */

/**
 * Get the minimal-parse draft status for a file by its cdp-uploader file ID.
 *
 * @param {string} fileId
 * @returns {Promise<DraftStatusModel|null>} Shaped draft status, or null if
 *   no draft has been claimed yet for this file ID
 * @throws {GuidanceApiError} - If the infra layer reports a non-404 failure
 */
async function getDraftById (fileId) {
  const res = await draftsApi.getDraft(fileId)

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return null
  }

  const draft = {
    fileId: res.data.fileId,
    parsingStatus: res.data.parsingStatus,
    parsingError: res.data.parsingError ?? null,
    title: res.data.title ?? null,
    version: res.data.version ?? null,
    lastModified: res.data.lastModified ?? null
  }

  return draft
}

export {
  getDraftById
}
