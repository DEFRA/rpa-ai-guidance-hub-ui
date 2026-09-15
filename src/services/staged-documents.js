import { statusCodes } from '../constants/status-codes.js'
import * as stagedDocumentsApi from '../infra/guidance-api/staged-documents.js'

/**
 * Projected staged document status model exposed to application code.
 *
 * @typedef {Object} StagedDocumentStatusModel
 * @property {string} fileId
 * @property {string} parsingStatus - 'pending' | 'in_progress' | 'complete' |
 *   'failed'
 * @property {string|null} [parsingError]
 * @property {string|null} [title]
 * @property {string|null} [version]
 * @property {string|null} [lastModified]
 */

/**
 * Get the minimal-parse staged document status for a file by its
 * cdp-uploader file ID.
 *
 * @param {string} fileId
 * @returns {Promise<StagedDocumentStatusModel|null>} Shaped status, or null if
 *   no staged document has been claimed yet for this file ID
 * @throws {GuidanceApiError} - If the infra layer reports a non-404 failure
 */
async function getStagedDocumentById (fileId) {
  const res = await stagedDocumentsApi.getStagedDocument(fileId)

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return null
  }

  const stagedDocument = {
    fileId: res.data.fileId,
    parsingStatus: res.data.parsingStatus,
    parsingError: res.data.parsingError ?? null,
    title: res.data.title ?? null,
    version: res.data.version ?? null,
    lastModified: res.data.lastModified ?? null
  }

  return stagedDocument
}

export {
  getStagedDocumentById
}
