import { statusCodes } from '../../constants/status-codes.js'
import { buildGuidanceTable } from './table-builder.js'

async function getHubPage (_request, h) {
  const allGuidance = buildGuidanceTable([])
  const recentlyOpened = buildGuidanceTable([])
  const savedGuidance = buildGuidanceTable([])

  return h
    .view('hub/page.njk', {
      allGuidance,
      recentlyOpened,
      savedGuidance
    })
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getHubPage
}
