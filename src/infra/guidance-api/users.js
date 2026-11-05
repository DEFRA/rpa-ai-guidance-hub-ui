import { statusCodes } from '../../constants/status-codes.js'
import { guidanceApiClient } from './client.js'

/**
 * Find the user who has signed in, or make them on their first sign-in.
 *
 * @param {Object} signedIn
 * @param {string} signedIn.tenantId - The identity provider's tenant
 * @param {string} signedIn.objectId - The user's object id within it
 * @param {string|null} signedIn.displayName
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is the
 *   user's record, `{id, identity, displayName, createdAt}`: 201 when made,
 *   200 when found
 * @throws {GuidanceApiError} - When response is not ok
 */
async function signIn (signedIn) {
  return guidanceApiClient.request('/users', {
    method: 'POST',
    body: signedIn
  })
}

/**
 * The user, with the guides they have pinned.
 *
 * @param {string} userId - The hub's id for them
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is
 *   `{id, identity, displayName, createdAt, pinned}`, `pinned` in the user's
 *   order, each `{id, title}`
 * @throws {GuidanceApiError} - When response is not ok
 */
async function getUser (userId) {
  return guidanceApiClient.request(_userPath(userId))
}

/**
 * Change the user's pinned guides by a JSON Patch on their ordered ids.
 *
 * @param {string} userId
 * @param {Array<{op: string, path: string, value?: string, from?: string}>} operations
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - 204; not ok
 *   with 409 when a `test` failed (the pins changed since the page showed
 *   them) or 422 when the patch cannot apply (a guide pinned already)
 * @throws {GuidanceApiError} - When response is not ok, and not a 409 or 422
 */
async function patchPins (userId, operations) {
  return guidanceApiClient.request(`${_userPath(userId)}/pins`, {
    method: 'PATCH',
    body: operations,
    headers: { 'Content-Type': 'application/json-patch+json' },
    expected: [statusCodes.HTTP_STATUS_CONFLICT, statusCodes.HTTP_STATUS_UNPROCESSABLE_ENTITY],
    responseType: 'text'
  })
}

/**
 * The guides the user has pinned, in their order, that the filters let
 * through.
 *
 * @param {string} userId
 * @param {{audience?: string[], system?: string[], scheme?: string[], noScheme?: boolean}} [filters]
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is
 *   `{items, counts}`, each item a guide as `GET /guides` lists it
 * @throws {GuidanceApiError} - When response is not ok
 */
async function getPins (userId, filters = {}) {
  return guidanceApiClient.request(`${_userPath(userId)}/pins`, { query: _filterQuery(filters) })
}

/**
 * Record that the user has opened a guide.
 *
 * @param {string} userId
 * @param {string} guideId
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - 204
 * @throws {GuidanceApiError} - When response is not ok
 */
async function recordOpened (userId, guideId) {
  return guidanceApiClient.request(`${_userPath(userId)}/recently-opened`, {
    method: 'POST',
    body: { guideId },
    responseType: 'text'
  })
}

/**
 * The guides the user opened most recently, newest first, that the filters
 * let through.
 *
 * @param {string} userId
 * @param {{audience?: string[], system?: string[], scheme?: string[], noScheme?: boolean}} [filters]
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is
 *   `{items, counts}`, each item a guide as `GET /guides` lists it, with
 *   `openedAt`
 * @throws {GuidanceApiError} - When response is not ok
 */
async function getRecentlyOpened (userId, filters = {}) {
  return guidanceApiClient.request(`${_userPath(userId)}/recently-opened`, { query: _filterQuery(filters) })
}

/**
 * @private
 * @param {{audience?: string[], system?: string[], scheme?: string[], noScheme?: boolean}} filters
 * @returns {Object} The hub's filters as the API's lists of a user's guides
 *   take them
 */
function _filterQuery (filters) {
  return {
    audience: filters.audience,
    system: filters.system,
    scheme: filters.scheme,
    no_scheme: filters.noScheme ? 'true' : undefined
  }
}

/**
 * @private
 * @param {string} userId
 * @returns {string}
 */
function _userPath (userId) {
  return `/users/${encodeURIComponent(userId)}`
}

export {
  getPins,
  getRecentlyOpened,
  getUser,
  patchPins,
  recordOpened,
  signIn
}
