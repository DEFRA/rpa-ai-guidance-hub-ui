import { guidanceApiClient } from './client.js'

/**
 * Every one of the user's preferences, null for one they have not set.
 *
 * @param {string} userId - The hub's id for them
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is
 *   `{guideFormat, readingWidth, contentsWidth, guideInformationShown,
 *   sideNavCollapsed, sideNavWidth, sideNavPinnedCollapsed,
 *   sideNavBookmarksCollapsed}`
 * @throws {GuidanceApiError} - When response is not ok
 */
async function getPreferences (userId) {
  return guidanceApiClient.request(_preferencesPath(userId))
}

/**
 * Change the user's preferences by a JSON Merge Patch of the preferences
 * alone: a value sets one, null takes it back to its default, and the rest
 * stay as they are.
 *
 * @param {string} userId - The hub's id for them
 * @param {Object<string, unknown>} changes - By name
 * @returns {Promise<{ok: boolean, status: number, data: any}>} - data is every
 *   preference as it now is, as `getPreferences` answers them
 * @throws {GuidanceApiError} - When response is not ok
 */
async function patchPreferences (userId, changes) {
  return guidanceApiClient.request(_preferencesPath(userId), {
    method: 'PATCH',
    body: changes,
    headers: { 'Content-Type': 'application/merge-patch+json' }
  })
}

/**
 * @private
 * @param {string} userId
 * @returns {string}
 */
function _preferencesPath (userId) {
  return `/preferences/${encodeURIComponent(userId)}`
}

export {
  getPreferences,
  patchPreferences
}
