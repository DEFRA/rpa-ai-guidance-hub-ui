import { statusCodes } from '../../../constants/status-codes.js'
import { getGuideUpload, createGuideUpload, addGuideUpload } from '../session.js'
import { RESULTS, startMigration } from '../service.js'
import { ActionTypeViewModel } from './view-models.js'

const ACTION_TYPE_VIEW = 'create-guidance/action-type/page.njk'

/**
 * Render the action selection form page.
 *
 * @param {import('@hapi/hapi').Request} _request - Hapi request object (unused)
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 * @returns {Promise<import('@hapi/hapi').ResponseObject>} Rendered view response
 */
async function getActionForm (_request, h) {
  const viewModel = new ActionTypeViewModel()

  return h
    .view(ACTION_TYPE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Render the action form with validation errors and return HTTP 400.
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request with payload
 * @param {import('@hapi/hapi').ResponseToolkit} h - Hapi response toolkit
 * @param {Object} err - Joi validation error details
 * @returns {import('@hapi/hapi').ResponseObject}
 */
async function postActionFailAction (request, h, err) {
  const viewModel = ActionTypeViewModel.fromValidationError(request.payload, err)

  return h.view(ACTION_TYPE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
    .takeover()
}

/**
 * Handle POST from the action chooser form. Redirects to the appropriate
 * next step based on selected action.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject|import('@hapi/hapi').Toolkit} Redirect or rendered response
 */
async function postAction (request, h) {
  const { action } = request.payload || {}

  if (action === 'migrate') {
    await _handleMigrateSelect(request, h)
  }

  return h.redirect('/designer/dashboard')
}

/**
 * @private
 * Handle the migrate action selection by ensuring an upload exists,
 * starting a migration and routing to the appropriate next page.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>} Redirect response
 */
async function _handleMigrateSelect (request, h) {
  const upload = getGuideUpload(request) ?? createGuideUpload(request)

  const result = await startMigration(upload)

  if (result.code === RESULTS.UPLOAD_EXPENDED) {
    return h.redirect('/create-guidance/metadata')
  }

  if (result.code === RESULTS.MIGRATION_STARTED) {
    addGuideUpload(request, result.uploadId)
  }

  return h.redirect('/create-guidance/upload-guide')
}

export {
  getActionForm,
  postAction,
  postActionFailAction
}
