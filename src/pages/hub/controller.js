import { statusCodes } from '../../constants/status-codes.js'
import { HubViewModel } from './view-models.js'

async function getHubPage (_request, h) {
  const viewModel = new HubViewModel()

  return h
    .view('hub/page.njk', viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getHubPage
}
