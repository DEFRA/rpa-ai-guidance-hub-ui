import { statusCodes } from '../../constants/status-codes.js'
import { cdpUploaderClient } from './client.js'

/**
 * InitiateRequest - Domain type for starting an upload
 *
 * @typedef {Object} InitiateRequest
 * @property {string} [redirect] - Redirect URL for browser uploads (mutually exclusive with downloadUrls)
 * @property {string[]} [downloadUrls] - URLs to download and scan (mutually exclusive with redirect)
 * @property {string} s3Bucket - Destination bucket
 * @property {string} [s3Path] - Destination path prefix
 * @property {string} [callback] - Callback URL for scan completion
 * @property {Object<string, string>} [metadata] - Arbitrary metadata to round-trip
 * @property {string[]} [mimeTypes] - Accepted mime types
 * @property {number} [maxFileSize] - Max file size in bytes
 */

/**
 * Start an upload (browser-redirect flow or download-url flow)
 *
 * @param {InitiateRequest} initiateRequest
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {CdpUploaderError} - When response is not ok
 */
async function initiateUpload (initiateRequest) {
  return cdpUploaderClient.request('/initiate', {
    method: 'POST',
    body: initiateRequest
  })
}

/**
 * Get the status of an upload
 *
 * @param {string} uploadId - The ID returned from initiate
 * @param {{debug?: boolean}} [options] - Set debug to include the original initiate payload
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 * @throws {CdpUploaderError} - When response is not ok and not a 404 not found
 */
async function getUploadStatus (uploadId, { debug } = {}) {
  return cdpUploaderClient.request(`/status/${encodeURIComponent(uploadId)}`, {
    method: 'GET',
    query: debug ? { debug: 'true' } : undefined,
    expected: [statusCodes.HTTP_STATUS_NOT_FOUND]
  })
}

export {
  initiateUpload,
  getUploadStatus
}
