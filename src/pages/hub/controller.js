import Boom from '@hapi/boom'

import { CASE_TYPES } from '../../constants/case-types.js'
import { statusCodes } from '../../constants/status-codes.js'
import { createLogger } from '../../infra/logging/logger.js'
import { buildErrorLog } from '../../infra/logging/utils/build-error-log.js'
import * as guidesService from '../../services/guides.js'
import * as searchService from '../../services/search.js'
import * as usersService from '../../services/users.js'
import { formatIsoDate } from '../common/format-date.js'
import { guideSectionHref } from '../common/guide-section-href.js'
import { filterPanel, filtersFrom, sortFrom, WORDS_MAX_LENGTH, wordsFrom } from './filters.js'
import { allTitlesFrom, guideFrom, pageFrom, RESULTS_PER_PAGE } from './search.js'
import { HubViewModel } from './view-models.js'

const HUB_VIEW = 'hub/page.njk'

const logger = createLogger()
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
 * @private
 * The hub's list of every guide the filters let through, beside the filters
 * and sort, the user's pinned guides first. The words searched for are kept,
 * in the search box and as the filters change.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {Object} options
 * @param {string} options.words - Searched for
 * @param {boolean} options.searchUnavailable - Searching for them failed,
 *   which the list says above itself
 * @param {boolean} [options.wordsTooLong=false] - They are too long to search
 *   for, which the list says above itself instead
 */
async function _guideListPage (request, h, options) {
  const filters = filtersFrom(request.query)
  const sort = sortFrom(request.query)
  const [{ guides, counts }, pinned] = await Promise.all([
    _refusingUnknownFilters(guidesService.listEveryGuide({ filters, sort })),
    usersService.pinnedOf(request)
  ])
  const pinPositions = _pinPositions(pinned)

  const viewModel = new HubViewModel({
    allGuides: _pinnedFirst(guides.map((guide) => _toGuideItem(guide, pinPositions))),
    filters: filterPanel({ path: '/hub', filters, counts, sort, total: guides.length, withSort: true, words: options.words }),
    words: options.words,
    searchUnavailable: options.searchUnavailable,
    wordsTooLong: options.wordsTooLong ?? false
  })

  return h
    .view(HUB_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * @private
 * What the one guide whose title the words cover is for, which its panel
 * shows: only on the first page, as only it has the panel. Without it the
 * panel still shows, so a guide that can't be read is not the page's failure.
 *
 * @param {import('../../services/search.js').GuideResults} found
 * @param {number} page
 * @returns {Promise<string|null>}
 */
async function _promotedPurpose (found, page) {
  if (page !== 1) {
    return null
  }

  if (found.titles.length !== 1) {
    return null
  }

  try {
    const guide = await guidesService.getGuideById(found.titles[0].id)

    return guide?.metadata?.goal ?? null
  } catch (err) {
    logger.warn(buildErrorLog(err, { type: 'promoted_guide_unavailable' }), `Could not read the promoted guide: ${err.message}`)

    return null
  }
}

/**
 * The hub. With no words searched for, every guide the filters let through.
 * With words, a page of the guides that have them, from the search service,
 * each with its best sections, instead of the list, and the guides whose
 * title they cover above it; with a guide too, a page of that guide's
 * sections that have them. When search can't answer, the list again, saying
 * so, as the guides don't depend on search.
 */
async function getHubPage (request, h) {
  const words = wordsFrom(request.query)

  if (!words) {
    return _guideListPage(request, h, { words, searchUnavailable: false })
  }

  if (words.length > WORDS_MAX_LENGTH) {
    return _guideListPage(request, h, { words, searchUnavailable: false, wordsTooLong: true })
  }

  const page = pageFrom(request.query)
  const guide = guideFrom(request.query)
  const found = guide
    ? await searchService.searchGuide({ words, guideId: guide, page, perPage: RESULTS_PER_PAGE })
    : await searchService.searchGuides({ words, page, perPage: RESULTS_PER_PAGE })

  if (found.unavailable) {
    return _guideListPage(request, h, { words, searchUnavailable: true })
  }

  const promotedPurpose = guide ? null : await _promotedPurpose(found, page)

  return h
    .view(HUB_VIEW, new HubViewModel({ words, search: { words, page, guide, found, promotedPurpose, allTitles: allTitlesFrom(request.query) } }))
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
 * @private
 * The case the address narrows the bookmarked guides to (`case`), by its key:
 * its key and how its tag names it, as the prototype does (`Case: W1234567`).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} [key] - The case's, from the address
 * @returns {Promise<{key: string, text: string}|null>} Null when the address
 *   names none
 * @throws {Boom.Boom} 404 for a case the user has not got; 502 when the
 *   user's cases cannot be had from the API, as it cannot tell
 */
async function _narrowedTo (request, key) {
  if (key === undefined) {
    return null
  }

  const cases = await usersService.casesOf(request)

  if (!cases) {
    throw Boom.badGateway('The case bookmarks cannot be read')
  }

  const found = cases.find((each) => each.key === key)

  if (!found) {
    throw Boom.notFound()
  }

  return { key, text: `${CASE_TYPES[found.type].short}: ${found.ref}` }
}

/**
 * The side navigation's lists, by the HubViewModel list each shows: each
 * answers the guides the filters let through, each filter's counts among
 * them, and how it shows each as a row, with where it is among the user's
 * pins, so its star and the list agree; and the case the list is narrowed
 * to, for the bookmarked guides, from the address's `case` unless `query`
 * says otherwise.
 *
 * @type {Record<string, (request: import('@hapi/hapi').Request, filters: import('../../services/guides.js').Filters, query?: {case?: string}) => Promise<{guides: Array<object>, counts: object, rowOf: (guide: object) => object, narrowedTo?: {key: string, text: string}|null}>>}
 */
const LIST_SOURCES = {
  async pinned (request, filters) {
    const { guides, counts } = await usersService.listPinned(request, filters)

    return { guides, counts, rowOf: _toPinItem }
  },

  recentlyOpened: (request, filters) => _starred(usersService.listRecentlyOpened(request, filters), request),

  async bookmarkedGuides (request, filters, query = request.query) {
    const narrowedTo = await _narrowedTo(request, query.case)
    const listed = await _starred(usersService.listBookmarked(request, filters, narrowedTo?.key), request)

    return { ...listed, narrowedTo }
  }
}

/**
 * @private
 * Whether chosen filters had nothing to narrow: the list has no guides at all,
 * so the filters are not why it is empty. It takes asking again without them,
 * the case the bookmarked guides are narrowed to among them, which only an
 * empty list with filters chosen needs.
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

  const { guides: everyGuide } = await source(request, filtersFrom(), {})

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
 * narrow it; there is no sort. The bookmarked guides can be narrowed to one
 * case, which the filters show as a tag of their own.
 */
async function getHubListPage (request, h) {
  const shown = LISTS[request.params.list]
  const source = LIST_SOURCES[shown]
  const filters = filtersFrom(request.query)
  const { guides, counts, rowOf, narrowedTo } = await _refusingUnknownFilters(source(request, filters))
  const panel = filterPanel({ path: `/hub/${request.params.list}`, filters, counts, sort: sortFrom(), total: _guideCount(guides), withSort: false, narrowedTo })

  const viewModel = new HubViewModel({
    shown,
    [shown]: guides.map(rowOf),
    filters: panel,
    nothingToFilter: await _nothingToFilter(source, request, guides, panel),
    narrowedTo
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
