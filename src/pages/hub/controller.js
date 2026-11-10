import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import * as usersService from '../../services/users.js'
import { formatIsoDate } from '../common/format-date.js'
import { guideSectionHref } from '../common/guide-section-href.js'
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
 * @returns {{id: string, pin: {pinned: boolean, position: number|null, key: string}|null, title: string, href: string, versionNumber: string|null, purpose: string|null, lastUpdated: string, published: string}}
 */
function _toGuideItem (guide, pinPositions) {
  return {
    id: guide.id,
    pin: pinPositions && { pinned: pinPositions.has(guide.id), position: pinPositions.get(guide.id) ?? null, key: guide.id },
    title: guide.title ?? 'Untitled guide',
    href: `/guides/${encodeURIComponent(guide.id)}`,
    versionNumber: guide.versionNumber,
    purpose: guide.purpose,
    lastUpdated: formatIsoDate(guide.lastUpdated) ?? NOT_RECORDED,
    published: formatIsoDate(guide.createdAt) ?? NOT_RECORDED
  }
}

/**
 * A pin as the Pinned page lists it: a guide as the hub lists it; a section
 * by its heading, linking to it, with its guide's title. Each says where it
 * is among the user's pins, which its star sends to unpin it.
 *
 * @private
 * @param {import('../../services/guides.js').GuideSummary & {position: number, sectionId: string|null, section: string|null, heading: string|null}} pinned
 * @returns {object} As `_toGuideItem` makes it, with the guide's title as
 *   `guideTitle` for a section
 */
function _toPinItem (pinned) {
  const item = _toGuideItem(pinned, null)
  const pin = { pinned: true, position: pinned.position, sectionId: pinned.sectionId, key: usersService.pinKey(pinned) }

  if (!pinned.sectionId) {
    return { ...item, pin }
  }

  return {
    ...item,
    pin,
    title: pinned.heading ?? pinned.section ?? item.title,
    guideTitle: item.title,
    href: pinned.section ? guideSectionHref(pinned.id, pinned.section) : item.href,
    purpose: null
  }
}

/**
 * Each of the side navigation's lists, by the last part of its address
 * (`/hub/pinned`), and the HubViewModel list that it shows.
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
 * @private
 * A list's guides, each shown as the hub shows it, with its star.
 *
 * @param {Promise<{guides: Array<object>, counts: object}>} listing
 * @param {import('@hapi/hapi').Request} request
 * @returns {Promise<{guides: Array<object>, counts: object, rowOf: (guide: object) => object}>}
 */
async function _starred (listing, request) {
  const [{ guides, counts }, pinned] = await Promise.all([listing, usersService.pinnedOf(request)])
  const pinPositions = _pinPositions(pinned)

  return { guides, counts, rowOf: (guide) => _toGuideItem(guide, pinPositions) }
}

/**
 * The side navigation's lists, by the HubViewModel list each shows: each
 * answers the guides the filters let through, each filter's counts among
 * them, and how it shows each as a row, with where it is among the user's
 * pins, so its star and the list agree.
 *
 * @type {Record<string, (request: import('@hapi/hapi').Request, filters: import('../../services/guides.js').Filters) => Promise<{guides: Array<object>, counts: object, rowOf: (guide: object) => object}>>}
 */
const LIST_SOURCES = {
  async pinned (request, filters) {
    const { guides, counts } = await usersService.listPinned(request, filters)

    return { guides, counts, rowOf: _toPinItem }
  },

  recentlyOpened: (request, filters) => _starred(usersService.listRecentlyOpened(request, filters), request),

  bookmarkedGuides: (request, filters) => _starred(usersService.listBookmarked(request, filters), request)
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
 * @private
 * How many guides a list's rows are of, as the API's filter counts count
 * them: once each, though the Pinned page lists a guide and its sections as
 * rows of their own.
 *
 * @param {Array<{id: string}>} guides - The list's rows
 * @returns {number}
 */
function _guideCount (guides) {
  return new Set(guides.map((guide) => guide.id)).size
}

/**
 * One of the side navigation's lists on its own, in its own order (the
 * user's, for the pinned guides; newest first, for the recently opened ones;
 * by the user's cases, for the bookmarked ones), beside the filters, which
 * narrow it; there is no sort.
 */
async function getHubListPage (request, h) {
  const shown = LISTS[request.params.list]
  const source = LIST_SOURCES[shown]
  const filters = filtersFrom(request.query)
  const { guides, counts, rowOf } = await _refusingUnknownFilters(source(request, filters))
  const panel = filterPanel({ path: `/hub/${request.params.list}`, filters, counts, sort: sortFrom(), total: _guideCount(guides), withSort: false })

  const viewModel = new HubViewModel({
    shown,
    [shown]: guides.map(rowOf),
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
