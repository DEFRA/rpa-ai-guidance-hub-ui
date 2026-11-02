import { canUseHub } from '../../server/access-control.js'
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

export { getAccessDenied }
