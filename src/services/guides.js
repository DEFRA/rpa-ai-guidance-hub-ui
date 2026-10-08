import { statusCodes } from '../constants/status-codes.js'
import * as guidesApi from '../infra/guidance-api/guides.js'
import { getStagedDocumentById } from './staged-documents.js'

const RESULTS = {
  SAVE_STARTED: 'saveStarted', // accepted: the guide is saving in the background
  GUIDE_CREATED: 'guideCreated', // the one this upload made before
  UPLOAD_EXPIRED: 'uploadExpired', // the API has no staged file for the upload
  PARSE_PENDING: 'parsePending', // the staged file has not finished parsing
  PARSE_FAILED: 'parseFailed' // the staged file could not be parsed
}

/**
 * Convert an upload into a guide, recording its answers and who made it.
 *
 * Only the user's id and display name are sent: the id is what anything
 * should match on, and the name is a copy so a listing can say who made a
 * version without asking a directory.
 *
 * @param {Object} guide
 * @param {string} guide.uploadId
 * @param {string} guide.fileId
 * @param {Object} guide.metadata - The journey's answers
 * @param {{id: string, displayName: string}} guide.user - The signed-in
 *   user's profile
 * @returns {Promise<{code: string}>} One of `RESULTS`
 */
async function createGuide ({ uploadId, fileId, metadata, user }) {
  const res = await guidesApi.createGuide({
    source: { uploadId, fileId },
    metadata,
    createdBy: { id: user.id, displayName: user.displayName }
  })

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return { code: RESULTS.UPLOAD_EXPIRED }
  }

  if (res.status === statusCodes.HTTP_STATUS_CONFLICT) {
    return _whyNotParsed(fileId)
  }

  if (res.status === statusCodes.HTTP_STATUS_ACCEPTED) {
    return { code: RESULTS.SAVE_STARTED }
  }

  return { code: RESULTS.GUIDE_CREATED }
}

/**
 * The API refuses an unparsed file with one status whether its parse is
 * unfinished or failed, so ask the staged file which.
 *
 * @private
 * @param {string} fileId
 * @returns {Promise<{code: string}>}
 */
async function _whyNotParsed (fileId) {
  const stagedDocument = await getStagedDocumentById(fileId)

  if (!stagedDocument) {
    return { code: RESULTS.UPLOAD_EXPIRED }
  }

  if (stagedDocument.parsingStatus === 'failed') {
    return { code: RESULTS.PARSE_FAILED }
  }

  return { code: RESULTS.PARSE_PENDING }
}

export {
  createGuide,
  RESULTS
}
