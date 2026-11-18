import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../src/config/config.js'
import {
  preferencesResponse,
  userResponse
} from '../../fixtures/guidance-api.js'

const NAMES = Object.keys(preferencesResponse())

/**
 * Stands in for the guidance API's preferences of the signed-in user, keeping
 * each change as the API does, so a preference set on one request shows on
 * the next, in any session. It also finds the user as they sign in, so the
 * session knows the hub's id for them. `nock.cleanAll()` takes it away.
 *
 * @param {Object<string, unknown>} [kept] - The preferences set already
 * @returns {Object<string, unknown>} The preferences kept, by name, which
 *   each change reaches
 */
function keepPreferencesInTheApi (kept = {}) {
  const preferences = { ...kept }
  const user = userResponse()
  const path = `/preferences/${user.id}`
  const answer = () => preferencesResponse(preferences)

  nock(config.get('guidanceApi.baseUrl'))
    .persist()
    .post('/users').reply(statusCodes.HTTP_STATUS_OK, user)
    .get(path).reply(statusCodes.HTTP_STATUS_OK, answer)
    // The change is taken as the body is matched: with nock 15, a reply
    // function that asks for the body never answers.
    .patch(path, (changes) => _merge(preferences, changes))
    .reply(statusCodes.HTTP_STATUS_OK, answer)

  return preferences
}

/**
 * @private
 * @param {Object<string, unknown>} preferences - Changed in place
 * @param {Object<string, unknown>} changes - A merge patch: null takes one
 *   back to its default
 * @returns {boolean} True, so the patch matches
 */
function _merge (preferences, changes) {
  const known = Object.entries(changes).filter(([name]) => NAMES.includes(name))

  for (const [name, value] of known) {
    if (value === null) {
      delete preferences[name]
      continue
    }

    preferences[name] = value
  }

  return true
}

export { keepPreferencesInTheApi }
