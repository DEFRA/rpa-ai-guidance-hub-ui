import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import { relativeHref } from '../common/relative-href.js'
import { findHeading, resolveAnchors, resolveImages, splitIntoSections } from '../../services/guide-sections.js'
import * as guidesService from '../../services/guides.js'
import * as usersService from '../../services/users.js'
import { guideAssetHref } from './asset-href.js'
import { BOOKMARKED } from './bookmark/controller.js'
import { sectionHref } from './bookmark/view-model.js'
import { getGuideFormat, setGuideFormat } from './format.js'
import { isPanelCollapsed, setPanelCollapsed } from './panel.js'
import { getReadingWidth, setReadingWidth } from './reading-width.js'
import { buildMetadataRows, GuideViewModel } from './view-model.js'

const GUIDE_VIEW = 'guide/page.njk'
const FALLBACK_RETURN_URL = '/hub'
const ONE_YEAR_IN_SECONDS = 31536000
const ALLOWED_ASSET_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp'
])

/**
 * @private
 * @param {{page?: unknown, section?: unknown}} query - The page's number, or
 *   the anchor the hub knows a section by, as a link to a bookmarked section
 *   names it
 * @param {import('../../services/guide-sections.js').GuideSection[]} sections
 * @returns {{slug: string, page: number}|null} The heading of the section the
 *   address names, when it names no page
 */
function _namedHeading ({ page, section }, sections) {
  return page === undefined && typeof section === 'string' ? findHeading(sections, section) : null
}

/**
 * @private
 * @param {unknown} page - The `page` query parameter
 * @param {number} totalPages
 * @returns {number} `page` as a whole number within 1..totalPages
 */
function _pageWithin (page, totalPages) {
  const number = Number.parseInt(page, 10)

  if (Number.isNaN(number)) {
    return 1
  }

  return Math.min(Math.max(number, 1), Math.max(totalPages, 1))
}

/**
 * @private
 * @param {import('@hapi/hapi').Request} request
 * @returns {string} The address of this page, to come back to after the
 *   width form
 */
function _currentUrl (request) {
  return `${request.url.pathname}${request.url.search}`
}

/**
 * @private
 * @param {Array<{id: string, sectionId: string|null}>|null} pinned - The
 *   user's pins, guides and sections of guides, in their order
 * @param {string} guideId
 * @returns {{pinned: boolean, position: number|null}|null} Whether the whole
 *   guide is pinned, and where among the pins; null when the user's pins are
 *   not known, and the page offers no pin
 */
function _pinOf (pinned, guideId) {
  if (!pinned) {
    return null
  }

  const position = pinned.findIndex((pin) => pin.id === guideId && !pin.sectionId)

  return { pinned: position !== -1, position: position === -1 ? null : position }
}

/**
 * @private
 * @param {Array<{id: string, sectionId: string|null, section: string|null}>|null} pinned
 *   - The user's pins, guides and sections of guides, in their order
 * @param {string} guideId
 * @returns {Map<string, {position: number, sectionId: string, key: string}>|null}
 *   The guide's pinned sections by anchor, each with where it is among the
 *   pins; null when the user's pins are not known, and the page offers no pin
 */
function _pinnedSectionsOf (pinned, guideId) {
  if (!pinned) {
    return null
  }

  return new Map(pinned.flatMap((pin, position) => pin.id === guideId && pin.sectionId && pin.section
    ? [[pin.section, { position, sectionId: pin.sectionId, key: usersService.pinKey(pin) }]]
    : []))
}

/**
 * Show a guide, whole or a section at a time as the user chose, with its
 * contents and what the guide is about.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 * @throws {Boom.Boom} 404 when there is no such guide, or it has no content
 */
async function getGuidePage (request, h) {
  const { guideId } = request.params

  const [guide, content, pinned, cases] = await Promise.all([
    guidesService.getGuideById(guideId),
    guidesService.getGuideContent(guideId),
    usersService.pinnedOf(request),
    usersService.casesOf(request)
  ])

  const split = content ? splitIntoSections(content.markdown) : []

  if (!guide || split.length === 0) {
    throw Boom.notFound()
  }

  // Only the guide's content says which page has the section, and its
  // heading's anchor there, which can differ from the hub's.
  const named = _namedHeading(request.query, split)

  if (named) {
    return h.redirect(sectionHref(guide.id, named))
  }

  // Every view counts as opening the guide: a direct link can name a page, so
  // its address doesn't tell an opening from moving between its parts.
  await usersService.recordOpened(request, guide.id)

  const format = getGuideFormat(request)
  // In the traditional view every heading is on the page, so the guide's
  // links to them work as they are.
  const linked = format === 'stepper'
    ? resolveAnchors(split, page => GuideViewModel.pageHref(guideId, page))
    : split
  const sections = resolveImages(linked, href => guideAssetHref(href, guideId))

  const viewModel = new GuideViewModel({
    guide,
    sections,
    pageNumber: _pageWithin(request.query.page, sections.length),
    readingWidth: getReadingWidth(request),
    returnTo: _currentUrl(request),
    panelCollapsed: isPanelCollapsed(request),
    metadataRows: buildMetadataRows(guide.metadata),
    pin: _pinOf(pinned, guide.id),
    pinnedSections: _pinnedSectionsOf(pinned, guide.id),
    cases,
    bookmarked: request.yar.flash(BOOKMARKED)[0],
    format
  })

  return h
    .view(GUIDE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Remember the page width the user chose, then send them back to the page
 * they chose it on.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function postReadingWidth (request, h) {
  const { width, returnTo } = request.payload

  setReadingWidth(request, width)

  return h.redirect(relativeHref(returnTo, FALLBACK_RETURN_URL))
}

/**
 * Remember how the user reads guides, whole or a section at a time, then send
 * them back to their place in the guide.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function postFormat (request, h) {
  const { format, returnTo } = request.payload

  setGuideFormat(request, format)

  return h.redirect(relativeHref(returnTo, FALLBACK_RETURN_URL))
}

/**
 * Fold the "About this guide" panel away to its rail, or open it again, then
 * send the user back to the page they did it on.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function postPanelToggle (request, h) {
  const { collapsed, returnTo } = request.payload

  setPanelCollapsed(request, collapsed)

  return h.redirect(relativeHref(returnTo, FALLBACK_RETURN_URL))
}

/**
 * Serve an image from a guide's content. The API names an asset by a hash
 * of its bytes, so the same name never changes and the browser can keep it.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 * @throws {Boom.Boom} 404 when there is no such asset, or it is not a
 *   raster image type we allow
 */
async function getGuideAsset (request, h) {
  const { guideId, name } = request.params
  const asset = await guidesService.getGuideAsset(guideId, name)

  const contentType = asset?.contentType?.split(';')[0].trim().toLowerCase()

  if (!asset || !ALLOWED_ASSET_CONTENT_TYPES.has(contentType)) {
    throw Boom.notFound()
  }

  return h
    .response(asset.body)
    .type(contentType)
    .header('x-content-type-options', 'nosniff')
    .header('content-security-policy', "default-src 'none'; sandbox")
    .header('cache-control', asset.cacheControl ?? `private, max-age=${ONE_YEAR_IN_SECONDS}, immutable`)
}

export {
  getGuideAsset,
  getGuidePage,
  postFormat,
  postPanelToggle,
  postReadingWidth
}
