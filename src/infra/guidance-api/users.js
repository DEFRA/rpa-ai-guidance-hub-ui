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

export {
  signIn
}
