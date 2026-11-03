import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import { formatIsoDate } from '../common/format-date.js'
import { filterPanel, filtersFrom, sortFrom } from './filters.js'
import { HubViewModel } from './view-models.js'

const NOT_RECORDED = 'Not recorded'

/**
 * A listed guide as the "All guides" list shows it, as the prototype's hub
 * rows do. Its published date is when it was recorded: every upload goes
 * live.
 *
 * @private
 * @param {import('../../services/guides.js').GuideSummary} guide
 * @returns {{title: string, href: string, purpose: string|null, lastUpdated: string, published: string}}
 */
function _toGuideItem (guide) {
  return {
    title: guide.title ?? 'Untitled guide',
    href: `/guides/${encodeURIComponent(guide.id)}`,
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
 * and sort.
 */
async function getHubPage (request, h) {
  const filters = filtersFrom(request.query)
  const sort = sortFrom(request.query)
  const { guides, counts } = await _refusingUnknownFilters(guidesService.listEveryGuide({ filters, sort }))

  const viewModel = new HubViewModel({
    allGuides: guides.map(_toGuideItem),
    filters: filterPanel({ path: '/hub', filters, counts, sort, total: guides.length, withSort: true })
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
