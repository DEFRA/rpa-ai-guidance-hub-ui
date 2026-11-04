import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import * as usersService from '../../services/users.js'
import { formatIsoDate } from '../common/format-date.js'
import { filterPanel, filtersFrom, sortFrom, wordsFrom } from './filters.js'
import { HubViewModel } from './view-models.js'

const NOT_RECORDED = 'Not recorded'

/**
 * A listed guide as the "All guides" list shows it, as the prototype's hub
 * rows do. Its published date is when it was recorded: every upload goes
 * live.
 *
 * @private
 * @param {import('../../services/guides.js').GuideSummary} guide
 * @param {Map<string, number>|null} pinPositions - Where each pinned guide is
 *   among the user's pins; null when they are not known
 * @returns {{id: string, pin: {pinned: boolean, position: number|null}|null, title: string, href: string, versionNumber: string|null, purpose: string|null, lastUpdated: string, published: string}}
 */
function _toGuideItem (guide, pinPositions) {
  return {
    id: guide.id,
    pin: pinPositions && { pinned: pinPositions.has(guide.id), position: pinPositions.get(guide.id) ?? null },
    title: guide.title ?? 'Untitled guide',
    href: `/guides/${encodeURIComponent(guide.id)}`,
    versionNumber: guide.versionNumber,
    purpose: guide.purpose,
    lastUpdated: formatIsoDate(guide.lastUpdated) ?? NOT_RECORDED,
    published: formatIsoDate(guide.createdAt) ?? NOT_RECORDED
  }
}

/**
 * Each of the side navigation's lists, by the last part of its address
 * (`/hub/pinned`), and the HubViewModel table that it shows.
 */
const LISTS = {
  'recently-opened': 'recentlyOpened',
  pinned: 'pinned',
  'bookmarked-guides': 'bookmarkedGuides'
}

const LIST_PATHS = Object.keys(LISTS)

/**
 * @private
 * @param {Array<{id: string}>|null} pinned - The user's pins, in their order
 * @returns {Map<string, number>|null} Each pinned guide's position among them
 */
function _pinPositions (pinned) {
  return pinned && new Map(pinned.map((pin, position) => [pin.id, position]))
}

/**
 * @private
 * The pinned guides first, in the user's order, then the rest as they came.
 *
 * @param {Array<object>} items - As `_toGuideItem` makes them
 * @returns {Array<object>}
 */
function _pinnedFirst (items) {
  const pinned = items.filter((item) => item.pin?.pinned).sort((a, b) => a.pin.position - b.pin.position)

  return [...pinned, ...items.filter((item) => !item.pin?.pinned)]
}

/**
 * @private
 * A filter value the API's reference data does not have is the asker's
 * mistake (an address made by hand), not the hub's.
 *
 * @param {Promise<any>} listing
 * @returns {Promise<any>}
 * @throws {Boom.Boom} 400 when the API refuses a filter value
 */
async function _refusingUnknownFilters (listing) {
  try {
    return await listing
  } catch (err) {
    throw err.statusCode === statusCodes.HTTP_STATUS_UNPROCESSABLE_ENTITY ? Boom.badRequest(err.message) : err
  }
}

/**
 * The hub, listing every guide the filters let through, beside the filters
 * and sort, the user's pinned guides first. The words searched for are kept,
 * in the search box and as the filters change, but find nothing yet: the list
 * is every guide.
 */
async function getHubPage (request, h) {
  const filters = filtersFrom(request.query)
  const sort = sortFrom(request.query)
  const words = wordsFrom(request.query)
  const [{ guides, counts }, pinned] = await Promise.all([
    _refusingUnknownFilters(guidesService.listEveryGuide({ filters, sort })),
    usersService.pinnedOf(request)
  ])
  const pinPositions = _pinPositions(pinned)

  const viewModel = new HubViewModel({
    allGuides: _pinnedFirst(guides.map((guide) => _toGuideItem(guide, pinPositions))),
    filters: filterPanel({ path: '/hub', filters, counts, sort, total: guides.length, withSort: true, words }),
    words
  })

  return h
    .view('hub/page.njk', viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * One of the side navigation's lists on its own. None of them has a source
 * of guides yet, so each shows its empty message.
 */
function getHubListPage (request, h) {
  const viewModel = new HubViewModel({ shown: LISTS[request.params.list] })

  return h
    .view('hub/page.njk', viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getHubListPage,
  getHubPage,
  LIST_PATHS
}
