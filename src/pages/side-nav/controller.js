import { relativeHref } from '../common/relative-href.js'
import { setNavCollapsed } from './collapsed.js'

const FALLBACK_RETURN_URL = '/hub'

/**
 * Fold the side navigation away, or open it out again, then send the user
 * back to the page they did it on.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function postToggle (request, h) {
  const { collapsed, returnTo } = request.payload

  setNavCollapsed(request, collapsed)

  return h.redirect(relativeHref(returnTo, FALLBACK_RETURN_URL))
}

export {
  postToggle
}
