import { statusCodes } from '../../constants/status-codes.js'
import * as usersService from '../../services/users.js'
import { relativeHref } from '../common/relative-href.js'

const FALLBACK_RETURN_URL = '/hub'

// Where the side navigation lists the pinned guides.
const PINNED_SECTION = 'side-nav-pinned'

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

/**
 * Move a pinned guide from where the page showed it, then go back to the
 * page's pinned guides. A script that moved it in the page already is answered
 * with nothing to show, or with a conflict when the pins have changed since
 * the page showed them, so it can show them as they now are.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function postPinOrder (request, h) {
  const { order, from, to, returnTo } = request.payload

  const moved = await usersService.movePin(request, order, from, to)

  if (!returnTo) {
    return h.response().code(moved ? statusCodes.HTTP_STATUS_NO_CONTENT : statusCodes.HTTP_STATUS_CONFLICT)
  }

  return h.redirect(_backTo(returnTo, PINNED_SECTION))
}

export {
  postPinOrder,
  postPinToggle
}
