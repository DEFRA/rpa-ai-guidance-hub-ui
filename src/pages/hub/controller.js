import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import { formatIsoDate } from '../common/format-date.js'
import { HubViewModel } from './view-models.js'

/**
 * A listed guide as the "All guides" table shows it.
 *
 * @private
 * @param {import('../../services/guides.js').GuideSummary} guide
 * @returns {{title: string, href: string, lastModified: string, owner: string}}
 */
function _toAllGuidesItem (guide) {
  return {
    title: guide.title ?? 'Untitled guide',
    href: `/guides/${encodeURIComponent(guide.id)}`,
    lastModified: formatIsoDate(guide.lastUpdated) ?? 'Not recorded',
    owner: guide.owner ?? 'Not recorded'
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
  const { guides } = await guidesService.listGuides()
  const viewModel = new HubViewModel({ allGuides: guides.map(_toAllGuidesItem) })

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
