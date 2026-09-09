/**
 * Key used to store guide upload session data in yar
 * @type {string}
 */
const SESSION_KEY = 'guide-upload'

/**
 * Wrapper around session-stored uploads providing a small API used by
 * create-guidance flows.
 *
 * Each upload carries its own progress (`completedStepIds`), so a re-upload
 * after a rejected file starts from scratch rather than inheriting the
 * previous upload's completed checks.
 */
class GuideUpload {
  #uploads

  /**
   * Create a GuideUpload wrapper
   *
   * @param {Object} [data] - Plain object read from session storage
   * @param {Array<{uploadId: string, completedStepIds?: Array<string>, metadata?: Object}>} [data.uploads] - Upload entries, oldest first
   */
  constructor (data) {
    this.#uploads = data?.uploads ?? []
  }

  /**
   * The most recent upload entry - null if none
   *
   * @returns {{uploadId: string, completedStepIds?: Array<string>, metadata?: Object}|null}
   */
  get #activeUpload () {
    return this.#uploads.at(-1) ?? null
  }

  /**
   * The active (most recent) upload id - null if none
   *
   * @returns {string|null}
   */
  get activeUploadId () {
    return this.#activeUpload?.uploadId ?? null
  }

  /**
   * Steps confirmed complete for the active upload
   *
   * @returns {Array<string>}
   */
  get completedStepIds () {
    return this.#activeUpload?.completedStepIds ?? []
  }

  /**
   * Metadata captured for the active upload
   *
   * @returns {Object|null}
   */
  get metadata () {
    return this.#activeUpload?.metadata ?? null
  }

  /**
   * Does the session wrapper contain at least one upload
   * @returns {boolean}
   */
  hasUpload () {
    return this.activeUploadId !== null
  }

  /**
   * Record a new upload id, making it the active upload
   * @param {string} uploadId
   * @returns {void}
   */
  addUpload (uploadId) {
    this.#uploads.push({ uploadId, completedStepIds: [] })
  }

  /**
   * Update the list of completed step IDs for the active upload
   * @param {Array<string>} completedStepIds
   * @returns {void}
   */
  setCompletedStepIds (completedStepIds) {
    if (this.#activeUpload) {
      this.#activeUpload.completedStepIds = [...completedStepIds]
    }
  }

  /**
   * Update or set metadata for the active upload
   * @param {Object} metadata
   * @returns {void}
   */
  setMetadata (metadata) {
    if (this.#activeUpload) {
      this.#activeUpload.metadata = {
        ...(this.#activeUpload.metadata),
        ...metadata
      }
    }
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
  const upload = getGuideUpload(request) ?? new GuideUpload()

  upload.addUpload(uploadId)

  request.yar.set(SESSION_KEY, upload.toPlainObject())
}

/**
 * Update the completed step IDs of the active upload in session
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {Array<string>} completedStepIds
 * @returns {void}
 */
function setGuideUploadCompletedSteps (request, completedStepIds) {
  const upload = getGuideUpload(request)

  if (upload) {
    upload.setCompletedStepIds(completedStepIds)
    request.yar.set(SESSION_KEY, upload.toPlainObject())
  }
}

/**
 * Update the metadata of the active upload in session
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {Object} metadata
 * @returns {void}
 */
function setGuideUploadMetadata (request, metadata) {
  const upload = getGuideUpload(request)

  if (upload) {
    upload.setMetadata(metadata)
    request.yar.set(SESSION_KEY, upload.toPlainObject())
  }
}

/**
 * Get the metadata of the active upload from session
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Object|null}
 */
function getGuideUploadMetadata (request) {
  const upload = getGuideUpload(request)

  return upload?.metadata ?? null
}

export {
  SESSION_KEY,
  GuideUpload,
  getGuideUpload,
  createGuideUpload,
  addGuideUpload,
  setGuideUploadCompletedSteps,
  setGuideUploadMetadata,
  getGuideUploadMetadata
}
