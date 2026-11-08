import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import * as usersService from '../../services/users.js'
import { formatIsoDate } from '../common/format-date.js'
import { filterPanel, filtersFrom, sortFrom, wordsFrom } from './filters.js'
import { HubViewModel } from './view-models.js'

const HUB_VIEW = 'hub/page.njk'
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
 * @param {Array<{id: string, sectionId: string|null}>|null} pinned - The
 *   user's pins, guides and sections of guides, in their order
 * @returns {Map<string, number>|null} Each guide pinned whole, by its
 *   position among them all
 */
function _pinPositions (pinned) {
  return pinned && new Map(pinned.flatMap((pin, position) => pin.sectionId ? [] : [[pin.id, position]]))
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
    .view(HUB_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * The side navigation's lists that have a source of guides, by the
 * HubViewModel list each shows: each answers the guides the filters let
 * through, each filter's counts among them, and where each guide is among the
 * user's pins, so its star and the list agree.
 *
 * @type {Record<string, (request: import('@hapi/hapi').Request, filters: import('../../services/guides.js').Filters) => Promise<{guides: Array<object>, counts: object, pinPositions: Map<string, number>|null}>>}
 */
const LIST_SOURCES = {
  async pinned (request, filters) {
    const { guides, counts } = await usersService.listPinned(request, filters)

    return { guides, counts, pinPositions: new Map(guides.map((guide) => [guide.id, guide.position])) }
  },

  async recentlyOpened (request, filters) {
    const [{ guides, counts }, pinned] = await Promise.all([
      usersService.listRecentlyOpened(request, filters),
      usersService.pinnedOf(request)
    ])

    return { guides, counts, pinPositions: _pinPositions(pinned) }
  }
}

/**
 * @private
 * Whether chosen filters had nothing to narrow: the list has no guides at all,
 * so the filters are not why it is empty. It takes asking again without them,
 * which only an empty list with filters chosen needs.
 *
 * @param {(request: import('@hapi/hapi').Request, filters: import('../../services/guides.js').Filters) => Promise<{guides: Array<object>}>} source - The list's, from `LIST_SOURCES`
 * @param {import('@hapi/hapi').Request} request
 * @param {Array<object>} guides - The guides the filters let through
 * @param {{selected: Array<object>}} panel - The list's filter panel
 * @returns {Promise<boolean>}
 */
async function _nothingToFilter (source, request, guides, panel) {
  if (guides.length > 0 || panel.selected.length === 0) {
    return false
  }

  const { guides: everyGuide } = await source(request, filtersFrom())

  return everyGuide.length === 0
}

/**
 * One of the side navigation's lists on its own, in its own order (the
 * user's, for the pinned guides; newest first, for the recently opened
 * ones), beside the filters, which narrow it; there is no sort. A list with
 * no source of guides yet shows its empty message.
 */
async function getHubListPage (request, h) {
  const shown = LISTS[request.params.list]
  const source = LIST_SOURCES[shown]

  if (!source) {
    return h
      .view(HUB_VIEW, new HubViewModel({ shown }))
      .code(statusCodes.HTTP_STATUS_OK)
  }

  const filters = filtersFrom(request.query)
  const { guides, counts, pinPositions } = await _refusingUnknownFilters(source(request, filters))
  const panel = filterPanel({ path: `/hub/${request.params.list}`, filters, counts, sort: sortFrom(), total: guides.length, withSort: false })

  const viewModel = new HubViewModel({
    shown,
    [shown]: guides.map((guide) => _toGuideItem(guide, pinPositions)),
    filters: panel,
    nothingToFilter: await _nothingToFilter(source, request, guides, panel)
  })

  return h
    .view(HUB_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getHubListPage,
  getHubPage,
  LIST_PATHS
}
