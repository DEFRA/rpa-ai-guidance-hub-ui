import { statusCodes } from '../../../../constants/status-codes.js'
import { answersOf, getGuideById, guidesTitledLike } from '../../../../services/guides.js'
import { getStagedDocumentById } from '../../../../services/staged-documents.js'
import { mapValidationError } from '../../form-errors.js'
import { getGuideUpload, setGuideUploadUpdates } from '../../session.js'
import { ChoiceViewModel } from './view-model.js'

const CHOICE_VIEW = 'create-guidance/upload-guide/new-or-update/page.njk'
const UPLOAD_GUIDE_URL = '/create-guidance/upload-guide'
const METADATA_URL = '/create-guidance/upload-guide/metadata'

/**
 * Ask whether the upload is a new guide or a new version of one, and which.
 * The guides it could update are found by title: first the title read from
 * the file, then whatever words the form's Search button sends (a GET, so it
 * works without JavaScript).
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 */
async function getChoicePage (request, h) {
  const upload = getGuideUpload(request)

  if (!upload?.hasUpload()) {
    return h.redirect(UPLOAD_GUIDE_URL)
  }

  const q = request.query.q ?? (await getStagedDocumentById(upload.fileId))?.title ?? ''
  const viewModel = new ChoiceViewModel({
    kind: request.query.kind,
    q,
    guides: await guidesTitledLike(q)
  })

  return h.view(CHOICE_VIEW, viewModel).code(statusCodes.HTTP_STATUS_OK)
}

/**
 * Ask again, with what was missing, and the guides like the words searched.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @param {Error & {details: Array<Object>}} err
 */
async function choiceFailAction (request, h, err) {
  const { kind, guideId, q = '' } = request.payload ?? {}
  const viewModel = new ChoiceViewModel({
    kind,
    guideId,
    q,
    guides: await guidesTitledLike(q),
    ...mapValidationError(err)
  })

  return h.view(CHOICE_VIEW, viewModel).code(statusCodes.HTTP_STATUS_BAD_REQUEST).takeover()
}

/**
 * Keep the choice, then go on to the details, which start with the chosen
 * guide's. A new version replaces the guide's latest version as it is now.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 */
async function postChoice (request, h) {
  const { kind, guideId } = request.payload
  const updates = kind === 'update' ? guideId : null
  const guide = updates ? await getGuideById(updates) : null

  setGuideUploadUpdates(request, updates, guide ? answersOf(guide) : {}, guide?.latestVersion?.id ?? null)

  return h.redirect(METADATA_URL)
}

export {
  choiceFailAction,
  getChoicePage,
  postChoice
}
