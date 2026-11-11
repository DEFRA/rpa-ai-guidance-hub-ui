import { statusCodes } from '../../constants/status-codes.js'
import { keepPreferences } from '../../services/preferences.js'

/**
 * Keep a change a page's script sends behind the scenes, such as a width the
 * user left a pane at.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function postPreferences (request, h) {
  await keepPreferences(request, request.payload)

  return h.response().code(statusCodes.HTTP_STATUS_NO_CONTENT)
}

export {
  postPreferences
}
