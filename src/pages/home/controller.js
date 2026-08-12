import { statusCodes } from '../../constants/status-codes.js'
import { config } from '../../config/config.js'

async function getHomepage (_request, h) {
  return h
    .view('home/page.njk')
    .code(statusCodes.HTTP_STATUS_OK)
}

export { getHomepage }
