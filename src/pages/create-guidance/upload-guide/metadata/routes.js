import { getSchemes } from '../../../../services/reference-data.js'
import { toLabels } from './view-helpers.js'
import * as metadataController from './controller.js'
import { buildMetadataSchema } from './schemas/metadata-schema.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/metadata',
    handler: metadataController.getMetadataForm
  },
  {
    method: 'POST',
    path: '/create-guidance/upload-guide/metadata',
    options: {
      validate: {
        payload: async (payload, options) => {
          const schemeOptions = await getSchemes()
          const schema = buildMetadataSchema(schemeOptions)

          // The form posts option values; the schema and handlers work in labels.
          const labelled = payload.schemes === undefined
            ? payload
            : { ...payload, schemes: toLabels(payload.schemes, schemeOptions) }

          return schema.validateAsync(labelled, options)
        },
        failAction: metadataController.metadataFailAction
      }
    },
    handler: metadataController.saveMetadata
  }
]

export {
  routes
}
