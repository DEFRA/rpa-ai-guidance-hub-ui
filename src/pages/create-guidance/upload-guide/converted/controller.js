import { statusCodes } from '../../../../constants/status-codes.js'
import { takeConvertedGuide } from '../../session.js'
import { ConvertedViewModel } from './view-models.js'

const CONVERTED_VIEW = 'create-guidance/upload-guide/converted/page.njk'
const HUB_URL = '/hub'

/**
 * Confirm the guide just converted. Reached by redirect from check answers,
 * so a refresh doesn't convert again; it shows once, then gives way to the
 * hub.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function getConverted (request, h) {
  const convertedGuide = takeConvertedGuide(request)

  if (!convertedGuide) {
    return h.redirect(HUB_URL)
  }

  return h
    .view(CONVERTED_VIEW, new ConvertedViewModel(convertedGuide))
    .code(statusCodes.HTTP_STATUS_OK)
}

export {
  getConverted
}
