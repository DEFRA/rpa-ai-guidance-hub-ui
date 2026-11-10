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
 * The guides, and sections of guides, the signed-in user has pinned, in their
 * order, each with its guide's title. Not known when the user cannot be had,
 * which is logged: a page shows without them rather than failing.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<Array<{id: string, title: string|null, sectionId: string|null, section: string|null, heading: string|null}>|null>}
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
 * The signed-in user's cases, in their order, each with the guides and
 * sections bookmarked to it. Not known when the user cannot be had, which is
 * logged: a page shows without them rather than failing.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<Array<{key: string, type: string, ref: string, guides: Array<object>}>|null>}
 */
async function casesOf (request) {
  try {
    return (await _userOf(request)).cases ?? []
  } catch (err) {
    logger.warn(buildErrorLog(err, { type: 'cases_unavailable' }), `Could not find the user's cases: ${err.message}`)

    return null
  }
}

// Between a pinned section's guide id and its own, in its key.
const KEY_SEPARATOR = '/'

/**
 * What a page names a pin by, among the user's pins: a whole guide by its id,
 * a section by its guide's id and its own.
 *
 * @param {{id: string, sectionId: string|null}} pin - As the user's record has it
 * @returns {string}
 */
function pinKey ({ id, sectionId }) {
  return sectionId ? `${id}${KEY_SEPARATOR}${sectionId}` : id
}

/**
 * @param {string} key - A pin's, as `pinKey` makes it
 * @returns {string[]} The ids in it: its guide's, then its section's for a
 *   section
 */
function idsOfPinKey (key) {
  return key.split(KEY_SEPARATOR)
}

/**
 * Pin a guide, or a section of it, at the top of the signed-in user's pins.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string} guideId
 * @param {{section: string, heading: string}|null} [place] - The section, by
 *   its anchor, with its heading as the guide has it now; none for the whole
 *   guide
 * @returns {Promise<boolean>} Whether it changed anything (not if pinned already)
 */
async function pin (request, guideId, place = null) {
  return _patchPins(request, [{ op: 'add', path: '/0', value: { guideId, ...place } }])
}

/**
 * Unpin a guide, or a section of it, from where the page showed it. If the
 * pins have changed since, nothing changes.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string} guideId
 * @param {number} position - Where the page showed it, from 0
 * @param {string|null} [sectionId] - The section's; none for the whole guide
 * @returns {Promise<boolean>} Whether it changed anything
 */
async function unpin (request, guideId, position, sectionId = null) {
  return _patchPins(request, [
    ..._pinnedAt(position, guideId, sectionId),
    { op: 'remove', path: `/${position}` }
  ])
}

/**
 * Move a pin from one position to another, if the pins are still in the order
 * the page showed: every position is checked, so a page whose pins have
 * changed since, anywhere, changes nothing.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string[]} order - The pins' keys (`pinKey`), as the page showed them
 * @param {number} from - Where the pin to move is, from 0
 * @param {number} to - Where it goes, in the list without it (JSON Patch's move)
 * @returns {Promise<boolean>} Whether it changed anything
 */
async function movePin (request, order, from, to) {
  return _patchPins(request, [
    ...order.flatMap((key, position) => _pinnedAt(position, ...idsOfPinKey(key))),
    { op: 'move', from: `/${from}`, path: `/${to}` }
  ])
}

/**
 * @private
 * @param {number} position - Among the user's pins, from 0
 * @param {string} guideId
 * @param {string|null} [sectionId] - None for the whole guide
 * @returns {Array<object>} JSON Patch `test` operations that the guide, or
 *   that section of it, is pinned there: if either fails, the API refuses the
 *   whole patch
 */
function _pinnedAt (position, guideId, sectionId = null) {
  return [
    { op: 'test', path: `/${position}/guideId`, value: guideId },
    { op: 'test', path: `/${position}/sectionId`, value: sectionId }
  ]
}

/**
 * The signed-in user's pins, guides and sections of guides, in their order,
 * whose guides the filters let through: each its guide, with its position
 * among all their pins, which unpinning it sends, and for a section its id,
 * anchor and heading; and each filter's counts among their guides.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {import('./guides.js').Filters} [filters]
 * @returns {Promise<{guides: Array<import('./guides.js').GuideSummary & {position: number, sectionId: string|null, section: string|null, heading: string|null}>, counts: import('./guides.js').FilterCounts}>}
 */
async function listPinned (request, filters) {
  const res = await usersApi.getPins(await userIdOf(request), filters)

  return {
    guides: res.data.items.map(item => ({
      ...toGuideSummary(item),
      position: item.position,
      sectionId: item.sectionId,
      section: item.section,
      heading: item.heading
    })),
    counts: res.data.counts ?? {}
  }
}

/**
 * The guides the signed-in user opened most recently, newest first, that the
 * filters let through; and each filter's counts among them.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {import('./guides.js').Filters} [filters]
 * @returns {Promise<{guides: import('./guides.js').GuideSummary[], counts: import('./guides.js').FilterCounts}>}
 */
async function listRecentlyOpened (request, filters) {
  const res = await usersApi.getRecentlyOpened(await userIdOf(request), filters)

  return {
    guides: res.data.items.map(item => toGuideSummary(item)),
    counts: res.data.counts ?? {}
  }
}

/**
 * Record that the signed-in user has opened a guide. A failure is logged,
 * never shown: the guide opens all the same.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string} guideId
 * @returns {Promise<void>}
 */
async function recordOpened (request, guideId) {
  try {
    await usersApi.recordOpened(await userIdOf(request), guideId)
  } catch (err) {
    logger.warn(buildErrorLog(err, { type: 'record_opened_failed' }), `Could not record guide ${guideId} as opened: ${err.message}`)
  }
}

/**
 * @private
 * Change the user's pins by a JSON Patch (RFC 6902), which the API applies
 * whole or not at all: its `test` operations check that the pins are still as
 * the page showed them, so a page whose pins have changed since changes
 * nothing.
 *
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
  idsOfPinKey,
  listPinned,
  listRecentlyOpened,
  movePin,
  pin,
  pinKey,
  casesOf,
  pinnedOf,
  recordOpened,
  signIn,
  unpin,
  userIdOf
}
