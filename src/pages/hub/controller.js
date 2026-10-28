import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import * as referenceDataService from '../../services/reference-data.js'
import { createLogger } from '../../infra/logging/logger.js'
import { formatIsoDate } from '../common/format-date.js'
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
  'bookmarked-guides': 'bookmarkedGuides',
  'awaiting-my-review': 'awaitingMyReview'
}

const LIST_PATHS = Object.keys(LISTS)

async function getHubPage (_request, h) {
  const [{ guides }, shortLabels] = await Promise.all([
    guidesService.listGuides(),
    _getSchemeShortLabels()
  ])

  const viewModel = new HubViewModel({
    allGuides: guides.map((guide) => _toAllGuidesItem(guide, shortLabels))
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
