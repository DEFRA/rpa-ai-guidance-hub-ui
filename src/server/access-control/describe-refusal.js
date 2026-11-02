import { statusCodes } from '../../constants/status-codes.js'
import { roleDisplayNames } from '../../constants/roles.js'
import { ACCESS_DENIED_PATH, ROLE_REQUIRED_PATH, canUseHub } from './hub-access.js'

const DEFAULT_REASON = 'do this'

/**
 * Where to send a refused user, and why.
 *
 * - No Hub.Viewer: the access-denied page, with no reason to give.
 * - Can use the hub but lacks roles this route needs: the role-required page,
 *   with the display names of the missing roles (in the hub's order) and what the user was trying to do, which a route gives
 *   as `options.app.roleRequiredReason` (e.g. "upload a new guide").
 *
 * @typedef {object} Refusal
 * @property {string} redirectTo
 * @property {string[]} [missingRoles]
 * @property {string} [reason] what the refused route was for, as a verb phrase
 */

/**
 * The roles a route's scope asks for that the user lacks: every `+` role they
 * do not hold, and, when the scope lists plain alternatives, all of them if
 * they hold none.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {string[]}
 */
function unmetRoles (request) {
  const scope = request.route.settings.auth?.access?.[0]?.scope

  if (!scope) {
    return []
  }

  const held = request.auth.credentials.roles
  const unmet = (scope.required ?? []).filter((role) => !held.includes(role))
  const anyOf = scope.selection ?? []

  if (anyOf.length > 0 && !anyOf.some((role) => held.includes(role))) {
    unmet.push(...anyOf)
  }

  return unmet
}

/**
 * Where to send a signed-in user hapi has refused with a 403, or null when the
 * response is not a role refusal. Any method qualifies: hapi refuses before the
 * handler runs, so a refused form post has changed nothing.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {Refusal | null}
 */
function describeRefusal (request) {
  if (request.response.output.statusCode !== statusCodes.HTTP_STATUS_FORBIDDEN) {
    return null
  }

  if (!request.auth.isAuthenticated) {
    return null
  }

  if (!canUseHub(request.auth.credentials)) {
    return { redirectTo: ACCESS_DENIED_PATH }
  }

  const unmet = unmetRoles(request)

  if (unmet.length === 0) {
    return null
  }

  return {
    redirectTo: ROLE_REQUIRED_PATH,
    missingRoles: roleDisplayNames(unmet),
    reason: request.route.settings.app?.roleRequiredReason ?? DEFAULT_REASON
  }
}

export { describeRefusal }
