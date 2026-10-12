import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import { relativeHref } from '../common/relative-href.js'
import { resolveAnchors, splitIntoSections } from '../../services/guide-sections.js'
import * as guidesService from '../../services/guides.js'
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
 * @param {unknown} page - The `page` query parameter
 * @param {number} totalPages
 * @returns {number} `page` as a whole number within 1..totalPages
 */
function _pageNumber (page, totalPages) {
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
 * Show one section of a guide, with its contents and what the guide is
 * about.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 * @throws {Boom.Boom} 404 when there is no such guide, or it has no content
 */
async function getGuidePage (request, h) {
  const { guideId } = request.params

  const [guide, content] = await Promise.all([
    guidesService.getGuideById(guideId),
    guidesService.getGuideContent(guideId)
  ])

  const split = content ? splitIntoSections(content.markdown) : []

  if (!guide || split.length === 0) {
    throw Boom.notFound()
  }

  const sections = resolveAnchors(split, page => GuideViewModel.pageHref(guideId, page))

  const viewModel = new GuideViewModel({
    guide,
    sections,
    pageNumber: _pageNumber(request.query.page, sections.length),
    readingWidth: getReadingWidth(request),
    returnTo: _currentUrl(request),
    panelCollapsed: isPanelCollapsed(request),
    metadataRows: buildMetadataRows(guide.metadata)
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
  postPanelToggle,
  postReadingWidth
}
