import * as usersService from '../../services/users.js'
import { relativeHref } from '../common/relative-href.js'

const FALLBACK_RETURN_URL = '/hub'

/**
 * @private
 * @param {string} returnTo - The page to go back to, from the form
 * @param {string} [anchor] - A place on it
 * @returns {string} The page, without any place it named, at `anchor`
 */
function _backTo (returnTo, anchor) {
  const [page] = relativeHref(returnTo, FALLBACK_RETURN_URL).split('#')

  return anchor ? `${page}#${anchor}` : page
}

/**
 * Pin a guide at the top, or unpin it from where the page showed it, then go
 * back to the page. A page that showed pins which have changed since changes
 * nothing, and the page shows them as they now are.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function postPinToggle (request, h) {
  const { guideId, pin, position, returnTo, anchor } = request.payload

  await (pin ? usersService.pin(request, guideId) : usersService.unpin(request, guideId, position))

  return h.redirect(_backTo(returnTo, anchor))
}

export {
  postPinToggle
}
