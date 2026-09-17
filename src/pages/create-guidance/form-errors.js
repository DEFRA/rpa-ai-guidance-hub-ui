/**
 * Map a Joi validation error onto the two shapes the create-guidance form
 * templates render: `errors` for inline field messages and `errorList` for
 * the GOV.UK error summary.
 *
 * Only the first error per field is kept, so a field failing several rules
 * at once shows one message. With the server-wide `abortEarly: false`, Joi
 * reports details in schema key order, so `errorList` follows the order the
 * fields appear on the page as long as the schema declares them in that
 * order.
 *
 * @param {{details: Array<{path: Array<string>, message: string}>}} err - Joi validation error
 * @param {Object<string, string>} [fieldHrefMap={}] - Overrides for the
 *   summary link anchor per field; defaults to `#<field>`. Needed where the
 *   field's first input id differs from its name, e.g. `guideTitle` →
 *   `#guide-title`.
 * @returns {{errors: Object<string, string>, errorList: Array<{text: string, href: string}>}}
 */
function mapValidationError (err, fieldHrefMap = {}) {
  const errors = {}
  const errorList = []

  for (const detail of err.details) {
    const field = detail.path[0]

    if (errors[field]) {
      continue
    }

    errors[field] = detail.message

    errorList.push({
      text: detail.message,
      href: fieldHrefMap[field] || `#${field}`
    })
  }

  return { errors, errorList }
}

export {
  mapValidationError
}
