import { MISSING_ROLES_FLASH_KEY, canUseHub } from '../../server/access-control/hub-access.js'
import { statusCodes } from '../../constants/status-codes.js'

async function getAccessDenied (request, h) {
  if (canUseHub(request.auth.credentials)) {
    return h.redirect('/hub')
  }

  return h
    .view('access-denied/page.njk', {
      pageTitle: 'You do not have access to the guidance hub',
      hideSideNav: true,
      userEmail: request.auth.credentials.profile.email
    })
    .code(statusCodes.HTTP_STATUS_FORBIDDEN)
}

async function getRoleRequired (request, h) {
  const { missingRoles, reason } = request.yar.flash(MISSING_ROLES_FLASH_KEY)

  if (!missingRoles) {
    return h.redirect('/hub')
  }

  return h
    .view('access-denied/role-required.njk', {
      pageTitle: 'You do not have permission to do this',
      missingRoles: missingRoles.join(' and '),
      reason
    })
    .code(statusCodes.HTTP_STATUS_FORBIDDEN)
}

export { getAccessDenied, getRoleRequired }
