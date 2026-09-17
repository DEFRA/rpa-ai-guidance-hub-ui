import * as purposeController from './controller.js'
import { buildPurposeSchema } from './schemas/purpose-schema.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/metadata/purpose',
    handler: purposeController.getPurposeForm
  },
  {
    method: 'POST',
    path: '/create-guidance/upload-guide/metadata/purpose',
    options: {
      validate: {
        payload: async (payload, options) => {
          const referenceOptions = await purposeController.getPurposeOptions()
          const schema = buildPurposeSchema(referenceOptions)

          return schema.validateAsync(payload, options)
        },
        failAction: purposeController.purposeFailAction
      }
    },
    handler: purposeController.savePurpose
  }
]

export {
  routes
}
