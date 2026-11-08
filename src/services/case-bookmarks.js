/**
 * @module The cases each user bookmarks sections of guides to, by a case ID or
 * an SBI application number, in their own order. The API keeps them on the
 * user's record and changes them by JSON Patch; a bookmark here is one patch,
 * which tests that the case is still where the page found it, so a page whose
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
 * Bookmark a section of a guide to one of the signed-in user's cases, or to a
 * new one, which goes first. A section bookmarked to the case already is
 * left as it is.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {Object} place
 * @param {string} place.type - `case` or `sbi`
 * @param {string} place.ref - As kept (`keptReference`)
 * @param {string} place.guideId
 * @param {string} place.section - The section's anchor
 * @param {string} place.heading - The section's heading, as it reads now
 * @returns {Promise<boolean>} Whether it is bookmarked there now: not when the
 *   cases changed since they were read
 */
async function bookmark (request, { type, ref, guideId, section, heading }) {
  const cases = await casesOf(request) ?? []
  const position = cases.findIndex(each => each.type === type && each.ref === ref)
  const entry = { guideId, section, heading }

  if (position !== -1 && _holds(cases[position], guideId, section)) {
    return true
  }

  const operations = position === -1
    ? [{ op: 'add', path: '/0', value: { type, ref, bookmarks: [entry] } }]
    : [
        { op: 'test', path: `/${position}/key`, value: cases[position].key },
        { op: 'add', path: `/${position}/bookmarks/-`, value: entry }
      ]
  const res = await usersApi.patchCases(await userIdOf(request), operations)

  return res.ok
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
  bookmarkedSections,
  keptReference
}
