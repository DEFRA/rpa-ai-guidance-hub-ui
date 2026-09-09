import * as referenceDataApi from '../infra/guidance-api/reference-data.js'

/**
 * ReferenceOption - GOV.UK radios/checkboxes item shape
 *
 * @typedef {Object} ReferenceOption
 * @property {string} value
 * @property {string} text
 */

/**
 * "Not scheme-specific" is an opt-out choice for the "which scheme does this
 * guidance relate to?" question, not a scheme - it doesn't belong in the
 * guidance API's scheme reference data, so it's added here instead.
 */
const NOT_SCHEME_SPECIFIC_OPTION = {
  value: 'none',
  text: 'Not scheme-specific',
  divider: 'or'
}

/**
 * Fetch available schemes from the reference data service, plus the local
 * "not scheme-specific" opt-out option.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getSchemes () {
  const schemes = await _getOptions(referenceDataApi.getSchemes)

  return [...schemes, NOT_SCHEME_SPECIFIC_OPTION]
}

/**
 * Fetch available audiences from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getAudiences () {
  return _getOptions(referenceDataApi.getAudiences)
}

/**
 * Fetch available systems from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getSystems () {
  return _getOptions(referenceDataApi.getSystems)
}

/**
 * Fetch available guidance types from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getGuidanceTypes () {
  return _getOptions(referenceDataApi.getGuidanceTypes)
}

/**
 * @private
 * Call an infra reference-data fetcher and project its `{value, label}`
 * response into the `{value, text}` shape GOV.UK radios/checkboxes expect.
 *
 * @param {Function} fetcher - One of the infra guidance-api reference-data functions
 * @returns {Promise<ReferenceOption[]>}
 */
async function _getOptions (fetcher) {
  const { data } = await fetcher()

  return data.map(({ value, label }) => ({ value, text: label }))
}

export {
  getSchemes,
  getAudiences,
  getSystems,
  getGuidanceTypes
}
