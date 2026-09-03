/**
 * Key used to store guide upload session data in yar
 * @type {string}
 */
const SESSION_KEY = 'guide-upload'

/**
 * Wrapper around session-stored uploads providing a small API used by
 * create-guidance flows.
 */
class GuideUpload {
  #uploads

  /**
   * Create a GuideUpload wrapper
   *
   * @param {Object} [data] - Plain object read from session storage
   * @param {Array<Object>} [data.uploads] - Array of upload entries
   */
  constructor (data) {
    this.#uploads = data?.uploads ?? []
  }

  /**
   * The most recent active upload id (or null if none)
   * @returns {string|null}
   */
  get activeUploadId () {
    const uploadId = this.#uploads[0]?.uploadId

    return uploadId ?? null
  }

  /**
   * Does the session wrapper contain at least one upload
   * @returns {boolean}
   */
  hasUpload () {
    return this.activeUploadId !== null
  }

  /**
   * Record a new upload id in the session wrapper
   * @param {string} uploadId
   * @returns {void}
   */
  addUpload (uploadId) {
    this.#uploads.push({ uploadId })
  }

  /**
   * Serialize to a plain object that can be saved into the yar session
   * @returns {{uploads: Array<Object>}}
   */
  toPlainObject () {
    return {
      uploads: this.#uploads
    }
  }
}

/**
 * Create a new GuideUpload instance and persist it to the session
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object with yar
 * @returns {GuideUpload} The created GuideUpload wrapper
 */
function createGuideUpload (request) {
  const upload = new GuideUpload()

  request.yar.set(SESSION_KEY, upload.toPlainObject())

  return upload
}

/**
 * Retrieve the stored GuideUpload wrapper from the session, if any
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {GuideUpload|null}
 */
function getGuideUpload (request) {
  const data = request.yar.get(SESSION_KEY)

  return data ? new GuideUpload(data) : null
}

/**
 * Append a new upload id to the stored GuideUpload in session
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} uploadId
 * @returns {void}
 */
function addGuideUpload (request, uploadId) {
  const existing = getGuideUpload(request)

  const upload = existing || new GuideUpload()

  upload.addUpload(uploadId)

  request.yar.set(SESSION_KEY, upload.toPlainObject())
}

export {
  getGuideUpload,
  createGuideUpload,
  addGuideUpload
}
