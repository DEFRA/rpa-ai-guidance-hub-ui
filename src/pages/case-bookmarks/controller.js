import { statusCodes } from '../../constants/status-codes.js'
import * as caseBookmarks from '../../services/case-bookmarks.js'
import { withoutCase } from '../common/case-guides-href.js'
import { backTo } from '../common/relative-href.js'

// Where the side navigation lists the case bookmarks.
const CASES_SECTION = 'side-nav-bookmarks'

/**
 * @private
 * Go back to the page's case bookmarks, for a form; or, for a script that
 * changed the order in the page already, answer with nothing to show, or with
 * a conflict when the cases have changed since the page showed them, so it can
 * show them as they now are.
 *
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {string|undefined} returnTo - The form's page; none from a script
 * @param {boolean} moved
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function _answer (h, returnTo, moved) {
  if (returnTo !== undefined) {
    return h.redirect(backTo(returnTo, CASES_SECTION))
  }

  return h.response().code(moved ? statusCodes.HTTP_STATUS_NO_CONTENT : statusCodes.HTTP_STATUS_CONFLICT)
}

/**
 * @private
 * Remove what the form targets: its section if it names one, else its guide
 * if it names one, else the whole case.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {{ key: string, guideId?: string, sectionId?: string }} removal
 * @returns {Promise<boolean>} Whether the case went
 */
function _removeTarget (request, removal) {
  const { key, guideId, sectionId } = removal

  if (sectionId) {
    return caseBookmarks.removeSection(request, { key, guideId, sectionId })
  }

  if (guideId) {
    return caseBookmarks.removeGuide(request, { key, guideId })
  }

  return caseBookmarks.removeCase(request, key)
}

/**
 * Remove a case, with every guide bookmarked to it; or one guide of it, with
 * its sections; or one section; then go back to the page's case bookmarks,
 * no longer narrowed to the case if it went. A case that has changed since
 * the page showed it changes nothing.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function postRemove (request, h) {
  const { key, returnTo } = request.payload
  const caseWent = await _removeTarget(request, request.payload)
  const back = backTo(returnTo, CASES_SECTION)

  return h.redirect(caseWent ? withoutCase(back, key) : back)
}

/**
 * Move a case, if the cases are still as the page showed them.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function postCaseOrder (request, h) {
  const { returnTo, ...move } = request.payload

  return _answer(h, returnTo, await caseBookmarks.moveCase(request, move))
}

/**
 * Move a guide, with its bookmarked sections, among a case's guides, if they
 * are still as the page showed them.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
async function postGuideOrder (request, h) {
  const { returnTo, ...move } = request.payload

  return _answer(h, returnTo, await caseBookmarks.moveGuide(request, move))
}

export {
  postCaseOrder,
  postGuideOrder,
  postRemove
}
