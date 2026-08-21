import { statusCodes } from '../../../constants/status-codes.js'

async function getDashboard (_request, h) {
  return h
    .view('designer/dashboard/page.njk')
    .code(statusCodes.HTTP_STATUS_OK)
}

export { getDashboard }
