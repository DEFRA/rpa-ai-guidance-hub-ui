import { statusCodes } from '../../../constants/status-codes.js'
import { MigrateMetadataViewModel } from './view-models.js'

const MIGRATE_METADATA_VIEW = 'create-guidance/add-metadata/page.njk'

async function getMetadataForm (request, h) {
  const saved = request.yar.get('guidance')

  const viewModel = MigrateMetadataViewModel.fromSession(saved?.metadata)

  return h
    .view(MIGRATE_METADATA_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_OK)
}

async function addMetadataFailAction (request, h, err) {
  const viewModel = MigrateMetadataViewModel.fromValidationError(request.payload, err)

  return h
    .view(MIGRATE_METADATA_VIEW, viewModel)
    .code(statusCodes.HTTP_STATUS_BAD_REQUEST)
    .takeover()
}

async function addMetadata (request, h) {
  request.yar.set('guidance', {
    metadata: request.payload
  })

  return h.redirect('/create-guidance/upload')
}

export {
  getMetadataForm,
  addMetadata,
  addMetadataFailAction
}
