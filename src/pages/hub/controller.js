import { statusCodes } from '../../constants/status-codes.js'
import * as guidesService from '../../services/guides.js'
import * as referenceDataService from '../../services/reference-data.js'
import { formatIsoDate } from '../common/format-date.js'
import { HubViewModel } from './view-models.js'

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
    schemes: guide.schemes.map((label) => shortLabels.get(label) ?? label).join(', ') || 'Not recorded',
    lastModified: formatIsoDate(guide.lastUpdated) ?? 'Not recorded',
    owner: guide.owner ?? 'Not recorded'
  }
}

async function getHubPage (_request, h) {
  const [{ guides }, schemes] = await Promise.all([
    guidesService.listGuides(),
    referenceDataService.getSchemes()
  ])
  const shortLabels = new Map(schemes.map(({ label, shortLabel }) => [label, shortLabel]))
  const viewModel = new HubViewModel({
    allGuides: guides.map((guide) => _toAllGuidesItem(guide, shortLabels))
  })

  return h
    .view('hub/page.njk', viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getHubPage
}
