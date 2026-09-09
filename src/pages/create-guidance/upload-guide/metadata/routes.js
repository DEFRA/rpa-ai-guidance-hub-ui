import { getSchemes } from '../../../../services/reference-data.js'
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

          console.log(payload)

          return schema.validateAsync(payload, options)
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
