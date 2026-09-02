import { statusCodes } from '../../../constants/status-codes.js'
import { ActionTypeViewModel } from './view-models.js'

const ACTION_TYPE_VIEW = 'create-guidance/action-type/page.njk'

async function getActionForm (request, h) {
  const saved = request.yar.get('guidance')

  const viewModel = ActionTypeViewModel.fromSession(saved?.metadata)

  return h
    .view(ACTION_TYPE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

async function postActionFailAction (request, h, err) {
  const viewModel = ActionTypeViewModel.fromValidationError(request.payload, err)

  return h
    .view(ACTION_TYPE_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
    .takeover()
}

async function postAction (request, h) {
  const { action } = request.payload || {}

  if (action === 'migrate') {
    return h.redirect('/create-guidance/start-upload')
  }

  return h.redirect('/designer/dashboard')
}

export {
  getActionForm,
  postAction,
  postActionFailAction
}
