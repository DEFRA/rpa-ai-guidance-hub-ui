import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../src/config/config.js'
import { preferencesResponse, userResponse } from '../../fixtures/guidance-api.js'

// The preferences there are, by name.
const NAMES = Object.keys(preferencesResponse())

/**
 * Stands in for the guidance API's preferences of the signed-in user, keeping
 * each change as the API does, so that a preference set on one request shows on
 * the next, in any session. It also finds the user when they sign in, so the
 * session knows the hub's id for them. `nock.cleanAll()` takes it away.
 *
 * @param {Object<string, unknown>} [kept] - The preferences set already, by name
 * @returns {Object<string, unknown>} The preferences kept, by name, which each
 *   change reaches
 */
function keepPreferencesInTheApi (kept = {}) {
  const preferences = { ...kept }
  const user = userResponse()

  nock(config.get('guidanceApi.baseUrl'))
    .persist()
    .post('/users').reply(statusCodes.HTTP_STATUS_OK, user)
    .get(`/preferences/${user.id}`).reply(statusCodes.HTTP_STATUS_OK, () => preferencesResponse(preferences))
    // The change is taken as the request's body is matched, as a reply
    // function that asks for the body never answers. nock matches other
    // requests' bodies here too, so only preferences are taken.
    .patch(`/preferences/${user.id}`, (changes) => _merged(preferences, changes))
    .reply(statusCodes.HTTP_STATUS_OK, () => preferencesResponse(preferences))

  return preferences
}

/**
 * @private
 * @param {Object<string, unknown>} preferences - Changed in place
 * @param {Object<string, unknown>} changes - A merge patch: null takes one
 *   back to its default
 * @returns {boolean} True, so the patch matches
 */
function _merged (preferences, changes) {
  for (const [name, value] of Object.entries(changes).filter(([name]) => NAMES.includes(name))) {
    if (value === null) {
      delete preferences[name]
    } else {
      preferences[name] = value
    }
  }

  return true
}

export { keepPreferencesInTheApi }
