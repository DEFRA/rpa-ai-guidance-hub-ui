/**
 * @module How each user likes the hub shown, kept by the guidance API so that
 * their preferences follow them to any device and outlast their session. A
 * preference not set takes its default, which the part of the page it shapes
 * knows.
 *
 * A page still shows when the preferences cannot be read, with the defaults.
 * A change the API cannot keep is an error: nothing else keeps it.
 */

import * as preferencesApi from '../infra/guidance-api/preferences.js'
import { createLogger } from '../infra/logging/logger.js'
import { buildErrorLog } from '../infra/logging/utils/build-error-log.js'
import { userIdOf } from './users.js'

const logger = createLogger()

/**
 * The preferences the signed-in user has set, by name. Asked for once a
 * request, however many parts of the page need them.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<Object<string, unknown>>}
 */
function preferencesOf (request) {
  request.app.preferences ??= _kept(request)

  return request.app.preferences
}

/**
 * Keep a change to the signed-in user's preferences, straight away.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @param {Object<string, unknown>} changes - By name: a value sets one, null
 *   takes it back to its default
 * @returns {Promise<void>}
 * @throws {GuidanceApiError} When the API cannot keep it
 */
async function keepPreferences (request, changes) {
  const userId = await userIdOf(request)

  await preferencesApi.patchPreferences(userId, changes)
}

/**
 * @private
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<Object<string, unknown>>} Those the API keeps for the
 *   user, by name; none when they cannot be read
 */
async function _kept (request) {
  try {
    const userId = await userIdOf(request)
    const { data } = await preferencesApi.getPreferences(userId)

    return _setOnly(data)
  } catch (err) {
    logger.warn(
      buildErrorLog(err, { type: 'preferences_unavailable' }),
      `Could not read the user's preferences: ${err.message}`
    )

    return {}
  }
}

/**
 * @private
 * @param {Object<string, unknown>} preferences - Null for one not set
 * @returns {Object<string, unknown>} Only those set
 */
function _setOnly (preferences) {
  const set = Object.entries(preferences).filter(([, value]) => value !== null)

  return Object.fromEntries(set)
}

export {
  keepPreferences,
  preferencesOf
}
