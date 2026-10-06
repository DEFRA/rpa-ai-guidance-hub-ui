import { statusCodes } from '../constants/status-codes.js'
import * as guidesApi from '../infra/guidance-api/guides.js'

const RESULTS = {
  GUIDE_CREATED: 'guideCreated', // new, or the one this upload made before
  UPLOAD_EXPIRED: 'uploadExpired' // the API has no staged file for the upload
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

  return { code: RESULTS.GUIDE_CREATED }
}

export {
  createGuide,
  RESULTS
}
