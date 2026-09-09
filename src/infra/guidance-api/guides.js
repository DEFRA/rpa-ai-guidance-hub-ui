import { guidanceApiClient } from './client.js'

/**
 * NewGuide - what the API needs to make a guide out of an uploaded document
 *
 * @typedef {Object} NewGuide
 * @property {{uploadId: string, bucket: string, key: string, filename?: string}} source
 *   Where cdp-uploader delivered the document, read back from its status
 * @property {Object<string, any>} metadata - What the author said about the guide
 * @property {string} [createdBy] - Who submitted it
 */

/**
 * Create a guide from an uploaded document.
 *
 * The API converts the .docx and records the guide, and answers the same guide if
 * the same upload is sent twice - so a retry is safe and does not make a second one.
 *
 * @param {NewGuide} guide
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {GuidanceApiError} - When response is not ok
 */
async function createGuide (guide) {
  return guidanceApiClient.request('/guides', {
    method: 'POST',
    body: guide
  })
}

export {
  createGuide
}
