/**
 * @module The people who use the hub. The API knows each by an id of the
 * hub's own, found or made when they sign in; the session keeps it, and
 * everything the hub keeps for a user is by that id, never the identity
 * provider's.
 */

import { config } from '../config/config.js'
import * as usersApi from '../infra/guidance-api/users.js'

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
 * nobody has to sign in again.
 *
 * @param {import('@hapi/hapi').Request} request - Signed in
 * @returns {Promise<string>}
 */
async function userIdOf (request) {
  const { sessionId, userId, ...session } = request.auth.credentials

  if (userId) {
    return userId
  }

  const resolved = await signIn(session.profile)

  await request.server.app.cache.set(`auth-session:${sessionId}`, { ...session, userId: resolved })

  return resolved
}

export {
  signIn,
  userIdOf
}
