/**
 * cdp-uploader API response bodies.
 *
 * Single owner of every response shape the cdp-uploader service sends, so
 * that no two tests can disagree about what upstream actually returns. Each
 * factory returns a fresh object and accepts overrides - nothing here is
 * shared mutable state.
 *
 * There is no sandbox instance of cdp-uploader to verify these against in
 * this repo, so shapes are instead modelled from the contract as consumed
 * by `src/infra/cdp-uploader/uploads.js` and projected by
 * `src/services/uploader.js`. Treat any field neither of those files reads
 * as illustrative rather than confirmed against the real API.
 */

/**
 * Body of `POST /initiate` on 200.
 *
 * `src/infra/cdp-uploader/uploads.js#initiateUpload` returns the client
 * response untouched, and `src/services/uploader.js#initiateUpload` reads
 * `uploadId`, `uploadUrl` and `statusUrl` from it - a plain resource
 * representation, nothing wrapped in a `success` envelope.
 *
 * @param {Object} [overrides] - Fields to override on the representation
 * @returns {{uploadId: string, uploadUrl: string, statusUrl: string}}
 */
function initiateUploadResponse (overrides = {}) {
  return {
    uploadId: 'up-1',
    uploadUrl: 'http://cdp-uploader.test/upload-and-scan/up-1',
    statusUrl: 'http://cdp-uploader.test/status/up-1',
    ...overrides
  }
}

/**
 * One file entry in the `form` object of `GET /status/{uploadId}`, for a
 * file that has finished scanning cleanly.
 *
 * Verified against `src/services/uploader.js#_projectFile`: a location is
 * built from `s3Bucket`/`s3Key` whenever `s3Key` is present, and no
 * `error` is projected when `hasError` is absent.
 *
 * @param {Object} [overrides] - Fields to override on the representation
 * @returns {Object}
 */
function completeFile (overrides = {}) {
  return {
    filename: 'guide.docx',
    contentType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileStatus: 'complete',
    s3Bucket: 'rpa-ai-guidance-hub-source-docs',
    s3Key: 'up-1/guide.docx',
    ...overrides
  }
}

/**
 * One file entry in the `form` object of `GET /status/{uploadId}`, for a
 * file the virus/type scan rejected.
 *
 * Verified against `src/services/uploader.js#_projectFile`: `hasError`
 * drives the projected `error: {code, message}` pair, and a rejected file
 * carries no `s3Key` - it was never written to the destination bucket.
 *
 * @param {Object} [overrides] - Fields to override on the representation
 * @returns {Object}
 */
function rejectedFile (overrides = {}) {
  return {
    filename: 'guide.exe',
    contentType: 'application/octet-stream',
    fileStatus: 'rejected',
    hasError: true,
    errorCode: 'rejectedType',
    errorMessage: 'The selected file must be a DOCX',
    ...overrides
  }
}

/**
 * Body of `GET /status/{uploadId}` on 200.
 *
 * Verified against `src/services/uploader.js#_projectUploadStatus`: form
 * fields are split from file fields by whether the value is an object,
 * and `numberOfRejectedFiles` drives the projected `hasRejectedFiles` flag.
 *
 * @param {Object} [overrides] - Fields to override on the representation
 * @returns {Object}
 */
function uploadStatusResponse (overrides = {}) {
  return {
    uploadStatus: 'ready',
    metadata: {},
    form: {
      file: completeFile()
    },
    numberOfRejectedFiles: 0,
    ...overrides
  }
}

export {
  initiateUploadResponse,
  completeFile,
  rejectedFile,
  uploadStatusResponse
}
