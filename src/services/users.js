/**
 * @module The people who use the hub. The API knows each by an id of the
 * hub's own, found or made when they sign in; the session keeps it, and
 * everything the hub keeps for a user is by that id, never the identity
 * provider's.
 */

import { config } from '../config/config.js'
import { createLogger } from '../infra/logging/logger.js'
import { buildErrorLog } from '../infra/logging/utils/build-error-log.js'
import * as usersApi from '../infra/guidance-api/users.js'
import { toGuideSummary } from './guides.js'

const logger = createLogger()

/**
 * Find or make the user who has signed in.
 *
 * The hub signs in from one Entra tenant, so a profile from before profiles
 * kept the tenant takes that one.
 *
 * @param {{id: string, tenantId?: string, displayName?: string}} profile - As
 *   the session keeps it: `id` is the identity provider's object id
 * @returns {Promise<string>} The hub's id for the user
 */
async function signIn (profile) {
  const res = await usersApi.signIn({
    tenantId: profile.tenantId ?? config.get('auth.entra.tenantId'),
    objectId: profile.id,
    displayName: profile.displayName ?? null
  })

  return res.data.id
}

/**
 * The hub's id for the signed-in user. A session from before sessions kept
 * it is resolved now, the first time it is needed, and kept from then on, so
 * nobody has to sign in again; within a request it is resolved once, however
 * many parts of the page need it.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<string>}
 */
function userIdOf (request) {
  const { userId } = request.auth.credentials

  if (userId) {
    return Promise.resolve(userId)
  }

  request.app.hubUserId ??= _resolveUserId(request)

  return request.app.hubUserId
}

/**
 * @private
 * @param {import('@hapi/hapi').Request} request - Signed in, its session
 *   without the hub's id for the user
 * @returns {Promise<string>}
 */
async function _resolveUserId (request) {
  const { sessionId, userId, ...session } = request.auth.credentials
  const resolved = await signIn(session.profile)

  await request.server.app.cache.set(`auth-session:${sessionId}`, { ...session, userId: resolved })

  return resolved
}

/**
 * @private
 * The signed-in user's record, with their pinned guides. Asked for once a
 * request, however many parts of the page need it.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<Object>}
 */
function _userOf (request) {
  request.app.hubUser ??= userIdOf(request).then((userId) => usersApi.getUser(userId)).then((res) => res.data)

  return request.app.hubUser
}

/**
 * The guides the signed-in user has pinned, in their order, each with its
 * title. Not known when the user cannot be had, which is logged: a page shows
 * without them rather than failing.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<Array<{id: string, title: string|null}>|null>}
 */
async function pinnedOf (request) {
  try {
    return (await _userOf(request)).pinned ?? []
  } catch (err) {
    logger.warn(buildErrorLog(err, { type: 'pins_unavailable' }), `Could not find the user's pins: ${err.message}`)

    return null
  }
}

/**
 * Pin a guide at the top of the signed-in user's pins.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string} guideId
 * @returns {Promise<boolean>} Whether it changed anything (not if pinned already)
 */
async function pin (request, guideId) {
  return _patchPins(request, [{ op: 'add', path: '/0', value: guideId }])
}

/**
 * Unpin a guide from where the page showed it. If the pins have changed since,
 * nothing changes.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string} guideId
 * @param {number} position - Where the page showed it, from 0
 * @returns {Promise<boolean>} Whether it changed anything
 */
async function unpin (request, guideId, position) {
  return _patchPins(request, [
    { op: 'test', path: `/${position}`, value: guideId },
    { op: 'remove', path: `/${position}` }
  ])
}

/**
 * Move a pinned guide from one position to another, if the pins are still in
 * the order the page showed: every position is checked, so a page whose pins
 * have changed since, anywhere, changes nothing.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string[]} order - The pinned guides' ids, as the page showed them
 * @param {number} from - Where the guide to move is, from 0
 * @param {number} to - Where it goes, in the list without it (JSON Patch's move)
 * @returns {Promise<boolean>} Whether it changed anything
 */
async function movePin (request, order, from, to) {
  return _patchPins(request, [
    ...order.map((guideId, position) => ({ op: 'test', path: `/${position}`, value: guideId })),
    { op: 'move', from: `/${from}`, path: `/${to}` }
  ])
}

/**
 * The guides the signed-in user has pinned, in their order, that the filters
 * let through, and each filter's counts among them.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {import('./guides.js').Filters} [filters]
 * @returns {Promise<{guides: import('./guides.js').GuideSummary[], counts: import('./guides.js').FilterCounts}>}
 */
async function listPinned (request, filters) {
  const res = await usersApi.getPins(await userIdOf(request), filters)

  return { guides: res.data.items.map(item => toGuideSummary(item)), counts: res.data.counts ?? {} }
}

/**
 * @private
 * @param {import('@hapi/hapi').Request} request
 * @param {Array<object>} operations
 * @returns {Promise<boolean>} False when the API refused the patch as stale or
 *   not applicable, which leaves the pins as they are
 */
async function _patchPins (request, operations) {
  const res = await usersApi.patchPins(await userIdOf(request), operations)

  return res.ok
}

export {
  listPinned,
  movePin,
  pin,
  pinnedOf,
  signIn,
  unpin,
  userIdOf
}
