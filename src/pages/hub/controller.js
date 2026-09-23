import { statusCodes } from '../../constants/status-codes.js'
import { buildGuidanceTable } from './table-builder.js'

const ALLOWED_TABS = [
  'recently-opened',
  'saved-guidance',
  'editing',
  'awaiting-approval'
]
const DEFAULT_TAB = 'recently-opened'

async function getHubPage (request, h) {
  const tab = request?.query?.tab
  const activeTab = ALLOWED_TABS.includes(tab) ? tab : DEFAULT_TAB

  const recentlyOpened = buildGuidanceTable([], 'recent')
  const savedGuidance = buildGuidanceTable([], 'saved')
  const editing = buildGuidanceTable([], 'editing')
  const awaitingApproval = buildGuidanceTable([], 'awaiting-approval')

  return h
    .view('hub/page.njk', {
      recentlyOpened,
      savedGuidance,
      editing,
      awaitingApproval,
      activeTab
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  ALLOWED_TABS,
  DEFAULT_TAB,
  getHubPage
}
