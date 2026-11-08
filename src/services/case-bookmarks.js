/**
 * @module The cases each user bookmarks sections of guides to, by a case ID or
 * an SBI application number, in their own order. The API keeps them on the
 * user's record and changes them by JSON Patch; a bookmark here is one patch,
 * which tests that the cases are still those the page offered, so a page whose
 * cases have changed since changes nothing.
 */

import { namedCases } from '../constants/case-types.js'
import * as usersApi from '../infra/guidance-api/users.js'
import { casesOf, userIdOf } from './users.js'

// How many digits follow a case ID's letter, and make an SBI application
// number.
const CASE_ID_DIGITS = 7
const SBI_DIGITS = 9

// The lowest SBI: DEFRA's services accept none below it, nor any of more than
// nine digits.
const LOWEST_SBI = 105000000

/**
 * @private
 * @param {string} text
 * @param {number} count
 * @returns {boolean} Whether it is exactly `count` digits
 */
function _isDigits (text, count) {
  return text.length === count && [...text].every(character => character >= '0' && character <= '9')
}

/**
 * @private
 * @param {string} character
 * @returns {boolean} Whether it is one of the letters A to Z, either case
 */
function _isLetter (character) {
  const upper = character.toUpperCase()

  return upper.length === 1 && upper >= 'A' && upper <= 'Z'
}

/**
 * A reference as the hub keeps it, white space around it dropped: a case ID
 * is a letter, kept upper case, then exactly seven digits; an SBI application
 * number is nine digits, from 105000000 to 999999999.
 *
 * @param {string} type - `case` or `sbi`
 * @param {string} text - As typed
 * @returns {string|null} Null when it is not one
 */
function keptReference (type, text) {
  const ref = text.trim()

  if (type === 'case' && _isLetter(ref.slice(0, 1)) && _isDigits(ref.slice(1), CASE_ID_DIGITS)) {
    return ref.toUpperCase()
  }

  return type === 'sbi' && _isDigits(ref, SBI_DIGITS) && Number(ref) >= LOWEST_SBI ? ref : null
}

/**
 * @private
 * @param {{guides: Array<{id: string, bookmarks: Array<{section: string|null}>}>}} found
 * @param {string} guideId
 * @param {string} section
 * @returns {boolean} Whether the case has that section of the guide already
 */
function _holds (found, guideId, section) {
  const guide = found.guides.find(each => each.id === guideId)

  return Boolean(guide?.bookmarks.some(each => each.section === section))
}

/**
 * @private
 * @param {Array<{key: string}>} cases - The user's, as they are now
 * @param {string[]} shown - The keys of the cases a page offered
 * @returns {boolean} Whether they are the cases the page offered, in its order
 */
function _asShown (cases, shown) {
  return cases.length === shown.length && cases.every((each, at) => each.key === shown[at])
}

/**
 * Bookmark a section of a guide to one of the signed-in user's cases, or to a
 * new one, which goes first, if the cases are still those the page offered:
 * one removed and made again meanwhile is another case. A section bookmarked
 * to the case already is left as it is.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {Object} place
 * @param {string} place.type - `case` or `sbi`
 * @param {string} place.ref - As kept (`keptReference`)
 * @param {string} place.guideId
 * @param {string} place.section - The section's anchor
 * @param {string} place.heading - The section's heading, as it reads now
 * @param {string[]} place.shown - The keys of the cases the page offered, in
 *   its order
 * @returns {Promise<boolean>} Whether it is bookmarked there now: not when the
 *   cases changed since the page offered them
 */
async function bookmark (request, { type, ref, guideId, section, heading, shown }) {
  const cases = await casesOf(request) ?? []

  if (!_asShown(cases, shown)) {
    return false
  }

  const position = cases.findIndex(each => each.type === type && each.ref === ref)
  const entry = { guideId, section, heading }

  if (position !== -1 && _holds(cases[position], guideId, section)) {
    return true
  }

  const adding = position === -1
    ? { op: 'add', path: '/0', value: { type, ref, bookmarks: [entry] } }
    : { op: 'add', path: `/${position}/bookmarks/-`, value: entry }

  return _patchCases(request, [...shown.map((key, at) => _caseStill(at, key)), adding])
}

/**
 * @private
 * @param {import('@hapi/hapi').Request} request
 * @param {Array<object>} operations
 * @returns {Promise<boolean>} Whether the patch was made: not when a `test`
 *   failed, the cases having changed since they were read, nor when the patch
 *   no longer fits them
 */
async function _patchCases (request, operations) {
  const res = await usersApi.patchCases(await userIdOf(request), operations)

  return res.ok
}

/**
 * @private
 * @param {number} position - The case's, among the user's
 * @param {string} key - The case's
 * @returns {{op: string, path: string, value: string}} The test that the case
 *   is still there
 */
function _caseStill (position, key) {
  return { op: 'test', path: `/${position}/key`, value: key }
}

/**
 * @private
 * One of the signed-in user's cases as it is now, with where it is among them.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} key
 * @returns {Promise<{position: number, found: Object}|null>} Null for a case
 *   the user has not got
 */
async function _caseNow (request, key) {
  const cases = await casesOf(request) ?? []
  const position = cases.findIndex(each => each.key === key)

  return position === -1 ? null : { position, found: cases[position] }
}

/**
 * @private
 * @param {import('@hapi/hapi').Request} request
 * @param {{position: number, found: {key: string}}} now
 * @returns {Promise<boolean>}
 */
function _removeCaseAt (request, { position, found }) {
  return _patchCases(request, [_caseStill(position, found.key), { op: 'remove', path: `/${position}` }])
}

/**
 * Remove one of the signed-in user's cases, with every section of a guide
 * bookmarked to it.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {string} key - The case's
 * @returns {Promise<boolean>} Whether it changed anything: not when the case
 *   has gone, or changed, since
 */
async function removeCase (request, key) {
  const now = await _caseNow(request, key)

  return now !== null && _removeCaseAt(request, now)
}

/**
 * @private
 * The operations that take bookmarks out of a case, and the case too when
 * they were all it had: then only if nothing was added to it meanwhile, which
 * the case being empty once they are out shows.
 *
 * @param {{position: number, found: {key: string}}} now - The case
 * @param {Array<object>} removals - The tests and removals of its bookmarks
 * @param {boolean} emptied - Whether they are all the case has
 * @returns {Array<object>}
 */
function _takingOut ({ position, found }, removals, emptied) {
  const operations = [_caseStill(position, found.key), ...removals]

  return emptied
    ? [...operations, { op: 'test', path: `/${position}/bookmarks`, value: [] }, { op: 'remove', path: `/${position}` }]
    : operations
}

/**
 * Take a guide, with every section of it bookmarked, out of one of the
 * signed-in user's cases. The case goes too when it was the case's only
 * guide, as a case with nothing in it is not kept.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {{key: string, guideId: string}} place
 * @returns {Promise<boolean>} Whether it changed anything: not when the case,
 *   or the guide in it, has gone since
 */
async function removeGuide (request, { key, guideId }) {
  const now = await _caseNow(request, key)
  const guide = now?.found.guides.find(each => each.id === guideId)

  if (!guide) {
    return false
  }

  const positions = guide.bookmarks.map(each => each.position).sort((a, b) => b - a)

  return _patchCases(request, _takingOut(now, [
    ...positions.map(at => ({ op: 'test', path: `/${now.position}/bookmarks/${at}/guideId`, value: guideId })),
    ...positions.map(at => ({ op: 'remove', path: `/${now.position}/bookmarks/${at}` }))
  ], now.found.guides.length === 1))
}

/**
 * Take one bookmarked section of a guide out of one of the signed-in user's
 * cases. The case goes too when it was the case's last bookmark.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {{key: string, guideId: string, sectionId: string}} place
 * @returns {Promise<boolean>} Whether it changed anything
 */
async function removeSection (request, { key, guideId, sectionId }) {
  const now = await _caseNow(request, key)
  const guide = now?.found.guides.find(each => each.id === guideId)
  const placed = guide?.bookmarks.find(each => each.sectionId === sectionId)

  if (!placed) {
    return false
  }

  const path = `/${now.position}/bookmarks/${placed.position}`

  return _patchCases(request, _takingOut(now, [
    { op: 'test', path: `${path}/sectionId`, value: sectionId },
    { op: 'remove', path }
  ], now.found.guides.flatMap(each => each.bookmarks).length === 1))
}

/**
 * Move one of the signed-in user's cases, if they are still the cases the
 * page showed, in that order.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {{order: string[], from: number, to: number}} move - `order` the
 *   cases' keys as shown; `to` in the list without it, as JSON Patch moves
 * @returns {Promise<boolean>} Whether it changed anything
 */
async function moveCase (request, { order, from, to }) {
  return _patchCases(request, [
    ...order.map((key, position) => _caseStill(position, key)),
    { op: 'move', from: `/${from}`, path: `/${to}` }
  ])
}

/**
 * The moves that put a case's bookmarks in the order of its guides, each
 * guide's bookmarks together: each is moved to just after the last one
 * placed, starting where the first of them is.
 *
 * @param {Array<{bookmarks: Array<{position: number}>}>} guides - In the new
 *   order, each with where its bookmarks are now
 * @returns {Array<{from: number, to: number}>} JSON Patch moves, in order
 */
function bookmarkMoves (guides) {
  const bookmarks = guides.flatMap(guide => guide.bookmarks)
  const positions = new Map(bookmarks.map(each => [each, each.position]))
  const moves = []
  let next = Math.min(...positions.values())

  for (const each of bookmarks) {
    const from = positions.get(each)

    if (from !== next) {
      moves.push({ from, to: next })
      positions.forEach((at, other) => positions.set(other, at >= next && at < from ? at + 1 : at))
      positions.set(each, next)
    }

    next += 1
  }

  return moves
}

/**
 * Move a guide, with every section of it bookmarked, among a case's guides,
 * if they are still the guides the page showed, in that order.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {{key: string, order: string[], from: number, to: number}} move -
 *   `order` the case's guides' ids as shown; `from` and `to` among them, `to`
 *   in the list without it
 * @returns {Promise<boolean>} Whether it changed anything: not when the case's
 *   guides are not as the page showed them
 */
async function moveGuide (request, { key, order, from, to }) {
  const now = await _caseNow(request, key)
  const guides = [...now?.found.guides ?? []]

  if (guides.map(guide => guide.id).join() !== order.join() || to >= guides.length) {
    return false
  }

  const stillThere = guides.flatMap(guide => guide.bookmarks.map(each => ({
    op: 'test', path: `/${now.position}/bookmarks/${each.position}/guideId`, value: guide.id
  })))

  guides.splice(to, 0, ...guides.splice(from, 1))

  return _patchCases(request, [
    _caseStill(now.position, key),
    ...stillThere,
    ...bookmarkMoves(guides).map(({ from: at, to: into }) => ({
      op: 'move', from: `/${now.position}/bookmarks/${at}`, path: `/${now.position}/bookmarks/${into}`
    }))
  ])
}

/**
 * Which cases each section of a guide is bookmarked to, named in a line.
 *
 * @param {Array<{type: string, ref: string, guides: Array<{id: string, bookmarks: Array<{section: string|null}>}>}>} cases
 *   - The user's, in their order
 * @param {string} guideId
 * @returns {Map<string, string>} By the section's anchor: `Case W1234567,
 *   SBI 123456789`
 */
function bookmarkedSections (cases, guideId) {
  const bySection = new Map()

  for (const found of cases) {
    const guide = found.guides.find(each => each.id === guideId)

    for (const { section } of guide?.bookmarks ?? []) {
      bySection.set(section, [...bySection.get(section) ?? [], found])
    }
  }

  return new Map([...bySection].map(([section, bookmarkedTo]) => [section, namedCases(bookmarkedTo)]))
}

export {
  bookmark,
  bookmarkMoves,
  bookmarkedSections,
  keptReference,
  moveCase,
  moveGuide,
  removeCase,
  removeGuide,
  removeSection
}
