import { buildMetadataSchema } from '../../schemas/metadata-schema.js'
import { buildPurposeSchema } from '../../purpose/schemas/purpose-schema.js'

/**
 * Build the schema that re-validates the metadata captured across both
 * form screens before a document is converted.
 *
 * The two screens already validate their own payload on submission, but
 * the reference option lists they validate against can change between
 * then and the user reaching this page (see `buildMetadataSchema`), so the
 * full answer set is checked again here against whatever options are
 * current.
 *
 * @param {Object} options
 * @param {Array<{value: string}>} options.schemeOptions - Valid scheme reference options
 * @param {Array<{value: string}>} options.systemOptions - Valid system reference options
 * @param {Array<{value: string}>} options.audienceOptions - Valid audience reference options
 * @returns {import('joi').ObjectSchema}
 */
function buildCheckAnswersSchema ({ schemeOptions, systemOptions, audienceOptions }) {
  return buildMetadataSchema(schemeOptions).concat(
    buildPurposeSchema({ systemOptions, audienceOptions })
  )
}

export {
  buildCheckAnswersSchema
}
