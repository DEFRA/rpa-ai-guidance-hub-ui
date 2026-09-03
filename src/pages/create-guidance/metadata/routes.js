import * as startNewGuide from './controller.js'
import { metadataSchema } from './schemas/metadata-schema.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/metadata',
    handler: startNewGuide.getMetadataForm
  },
  {
    method: 'POST',
    path: '/create-guidance/metadata',
    options: {
      validate: {
        payload: metadataSchema,
        failAction: startNewGuide.addMetadataFailAction
      }
    },
    handler: startNewGuide.addMetadata
  }
]

export {
  routes
}
