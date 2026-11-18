import Boom from '@hapi/boom'

import { config } from '../../../config/config.js'
import { statusCodes } from '../../../constants/status-codes.js'
import * as caseBookmarks from '../../../services/case-bookmarks.js'
import { findHeading, splitIntoSections } from '../../../services/guide-sections.js'
import * as guidesService from '../../../services/guides.js'
import * as usersService from '../../../services/users.js'
import { BOOKMARK_MESSAGES, BookmarkViewModel, chosenCase, sectionHref } from './view-model.js'

const BOOKMARK_VIEW = 'guide/bookmark/page.njk'

// Where the guide's page finds what was just bookmarked, to say so once.
const BOOKMARKED = 'guideBookmarked'

/**
 * @private
 * @param {import('@hapi/hapi').Request} request
 * @param {string|undefined} anchor - The section's, as the hub knows it
 * @returns {Promise<{guide: Object, heading: {anchor: string, slug: string, title: string, page: number}}>}
 * @throws {Boom.Boom} 404 when there is no such guide, or it has no heading
 *   there
 */
async function _sectionOf (request, anchor) {
  const { guideId } = request.params
  const [guide, content] = await Promise.all([
    guidesService.getGuideById(guideId),
    guidesService.getGuideContent(guideId)
  ])
  const heading = guide && content && anchor ? findHeading(splitIntoSections(content.markdown), anchor) : null

  if (!heading) {
    throw Boom.notFound()
  }

  return { guide, heading }
}

/**
 * Ask which case to bookmark the section the address names to.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function getBookmarkPage (request, h) {
  const { guide, heading } = await _sectionOf(request, request.query.section)

  return h.view(BOOKMARK_VIEW, new BookmarkViewModel({
    guide,
    heading,
    cases: await usersService.casesOf(request) ?? [],
    sbiBookmarks: config.get('featureFlags.sbiBookmarks')
  }))
}

/**
 * Bookmark the section to the case chosen, then show the guide there, saying
 * so; or ask again, saying what is wrong.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 * @throws {Boom.Boom} 502 when the user's cases cannot be had from the API, as
 *   nothing can be saved without checking them
 */
async function postBookmark (request, h) {
  const { guide, heading } = await _sectionOf(request, request.payload.section)
  const cases = await usersService.casesOf(request)

  if (!cases) {
    throw Boom.badGateway(BOOKMARK_MESSAGES.casesUnreadable)
  }

  const sbiBookmarks = config.get('featureFlags.sbiBookmarks')
  const chosen = chosenCase(request.payload, cases, sbiBookmarks)
  const askAgain = (errors, code) => h
    .view(BOOKMARK_VIEW, new BookmarkViewModel({ guide, heading, cases, sbiBookmarks, answer: request.payload, errors }))
    .code(code)

  if (chosen.errors) {
    return askAgain(chosen.errors, statusCodes.HTTP_STATUS_BAD_REQUEST)
  }

  const saved = await caseBookmarks.bookmark(request, {
    ...chosen,
    guideId: guide.id,
    section: heading.anchor,
    heading: heading.title,
    shown: request.payload.shown
  })

  if (!saved) {
    return askAgain({ choice: BOOKMARK_MESSAGES.changedSince }, statusCodes.HTTP_STATUS_CONFLICT)
  }

  request.yar.flash(BOOKMARKED, { guideId: guide.id, type: chosen.type, ref: chosen.ref, heading: heading.title })

  return h.redirect(sectionHref(guide.id, heading))
}

export {
  BOOKMARKED,
  getBookmarkPage,
  postBookmark
}
