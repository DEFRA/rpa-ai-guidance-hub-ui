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

async function getHubPage (_request, h) {
  const { guides } = await guidesService.listGuides()
  const viewModel = new HubViewModel({ allGuides: guides.map(_toAllGuidesItem) })

  return h
    .view('hub/page.njk', viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getHubPage
}
