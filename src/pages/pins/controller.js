import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import * as usersService from '../../services/users.js'
import { backTo } from '../common/relative-href.js'

// Where the side navigation lists the pinned guides.
const PINNED_SECTION = 'side-nav-pinned'

/**
 * Pin a guide, or a section of it, at the top, or unpin it from where the
 * page showed it, then go back to the page, where the form says: to the star,
 * or the section's heading, which is not always at its section's anchor. A page that showed pins which have changed since changes nothing,
 * and the page shows them as they now are.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 * @throws {Boom.Boom} 404 when pinning a section the guide does not have
 */
async function postPinToggle (request, h) {
  const { guideId, pin, position, sectionId, section, returnTo, anchor } = request.payload

  if (pin) {
    await usersService.pin(request, guideId, section ? await _sectionOf(guideId, section) : null)
  } else {
    await usersService.unpin(request, guideId, position, sectionId ?? null)
  }

  return h.redirect(backTo(returnTo, anchor && encodeURIComponent(anchor)))
}

/**
 * @private
 * @param {string} guideId
 * @param {string} anchor - The section's
 * @returns {Promise<{section: string, heading: string}>} The section, with its
 *   heading as the guide has it now
 * @throws {Boom.Boom} 404 when the guide has no heading there
 */
async function _sectionOf (guideId, anchor) {
  const heading = await guidesService.headingOf(guideId, anchor)

  if (!heading) {
    throw Boom.notFound()
  }

  return { section: anchor, heading: heading.title }
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

  return h.redirect(backTo(returnTo, PINNED_SECTION))
}

export {
  postPinOrder,
  postPinToggle
}
