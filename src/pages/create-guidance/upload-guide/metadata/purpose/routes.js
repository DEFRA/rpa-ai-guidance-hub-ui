import { toLabels } from '../view-helpers.js'
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

          // The form posts option values; the schema and handlers work in labels.
          const labelled = { ...payload }

          for (const [field, optionsKey] of [['systems', 'systemOptions'], ['audience', 'audienceOptions']]) {
            if (payload[field] !== undefined) {
              labelled[field] = toLabels(payload[field], referenceOptions[optionsKey])
            }
          }

          return schema.validateAsync(labelled, options)
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
