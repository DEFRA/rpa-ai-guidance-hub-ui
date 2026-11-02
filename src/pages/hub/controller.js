import Boom from '@hapi/boom'

import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import * as referenceDataService from '../../services/reference-data.js'
import { createLogger } from '../../infra/logging/logger.js'
import { formatIsoDate } from '../common/format-date.js'
import { filterPanel, filtersFrom, sortFrom } from './filters.js'
import { HubViewModel } from './view-models.js'

const logger = createLogger()

const NOT_RECORDED = 'Not recorded'

/**
 * Each scheme's short label by its label. Short labels only decorate the
 * guide list, so when the schemes are unavailable the page still shows,
 * with every scheme as stored.
 *
 * @private
 * @returns {Promise<Map<string, string>>}
 */
async function _getSchemeShortLabels () {
  try {
    const schemes = await referenceDataService.getSchemes()

    return new Map(schemes.map(({ label, shortLabel }) => [label, shortLabel]))
  } catch (error) {
    logger.warn(error, 'Reference schemes unavailable; showing scheme labels as stored')
    return new Map()
  }
}

/**
 * A listed guide as the "All guides" table shows it.
 *
 * Guides store scheme labels; the table shows each scheme's short label, so
 * a stored label with no match (e.g. one since retired from the reference
 * data) is shown as stored.
 *
 * @private
 * @param {import('../../services/guides.js').GuideSummary} guide
 * @param {Map<string, string>} shortLabels - Scheme label to short label
 * @returns {{title: string, href: string, schemes: string, lastModified: string, owner: string}}
 */
function _toAllGuidesItem (guide, shortLabels) {
  return {
    title: guide.title ?? 'Untitled guide',
    href: `/guides/${encodeURIComponent(guide.id)}`,
    schemes: guide.schemes.map((label) => shortLabels.get(label) ?? label).join(', ') || NOT_RECORDED,
    lastModified: formatIsoDate(guide.lastUpdated) ?? NOT_RECORDED,
    owner: guide.owner ?? NOT_RECORDED
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
  const [{ guides, counts }, shortLabels] = await Promise.all([
    _refusingUnknownFilters(guidesService.listEveryGuide({ filters, sort })),
    _getSchemeShortLabels()
  ])

  const viewModel = new HubViewModel({
    allGuides: guides.map((guide) => _toAllGuidesItem(guide, shortLabels)),
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
