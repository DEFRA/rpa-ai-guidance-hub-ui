import * as referenceDataApi from '../infra/guidance-api/reference-data.js'

/**
 * ReferenceOption - a reference data value/label pair
 *
 * @typedef {Object} ReferenceOption
 * @property {string} value
 * @property {string} label
 */

/**
 * Value of the "Not scheme-specific" opt-out choice for the "which scheme
 * does this guidance relate to?" question. It's not a scheme the guidance
 * API itself knows about, but `getSchemes` always appends it below so every
 * caller - building the checkbox list, validating a submitted selection -
 * sees one consistent set of valid scheme values.
 */
const NONE_SCHEME_VALUE = 'none'
const NOT_SCHEME_SPECIFIC_OPTION = { value: NONE_SCHEME_VALUE, label: 'Not scheme-specific' }

/**
 * Fetch available schemes from the reference data service, plus the
 * "Not scheme-specific" opt-out choice (see NONE_SCHEME_VALUE above), which
 * always belongs alongside them however this list is used.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getSchemes () {
  const { data } = await referenceDataApi.getSchemes()

  return [...data, NOT_SCHEME_SPECIFIC_OPTION]
}

/**
 * Fetch available audiences from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getAudiences () {
  const { data } = await referenceDataApi.getAudiences()

  return data
}

/**
 * Fetch available systems from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getSystems () {
  const { data } = await referenceDataApi.getSystems()

  return data
}

/**
 * Fetch available guidance types from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getGuidanceTypes () {
  const { data } = await referenceDataApi.getGuidanceTypes()

  return data
}

/**
 * Normalize a submitted `schemes` field so "None" is mutually exclusive with
 * every other scheme: selecting "none" alone is a valid, self-contained
 * selection; selecting any other scheme alongside it drops "none".
 *
 * Unlike the getters above, this isn't a fetch wrapper - it's the one
 * scheme-specific business rule callers need, kept here because it depends
 * on the same `NONE_SCHEME_VALUE` this module owns.
 *
 * Submission shape is normalized first via `normalizeSelection`, so callers
 * (session persistence, redisplay view model) always receive an array back
 * regardless of how many boxes were checked or in what order.
 *
 * @param {undefined|string|Array<string>} rawSchemes
 * @returns {Array<string>}
 */
function normalizeSchemes (rawSchemes) {
  const schemes = normalizeSelection(rawSchemes)
  const nonNoneSchemes = schemes.filter((value) => value !== NONE_SCHEME_VALUE)

  if (nonNoneSchemes.length > 0) {
    return nonNoneSchemes
  }

  return schemes.includes(NONE_SCHEME_VALUE) ? [NONE_SCHEME_VALUE] : []
}

/**
 * Normalize a submitted checkbox group to an array.
 *
 * GOV.UK checkboxes submit differently depending on how many boxes are
 * checked (undefined when none, a bare string when exactly one, an array
 * when more than one) - this normalizes all three shapes to an array so
 * callers can treat every selection the same way.
 *
 * @param {undefined|null|string|Array<string>} rawSelection
 * @returns {Array<string>}
 */
function normalizeSelection (rawSelection) {
  if (rawSelection === undefined || rawSelection === null || rawSelection === '') {
    return []
  }

  return Array.isArray(rawSelection) ? rawSelection : [rawSelection]
}

export {
  getSchemes,
  getAudiences,
  getSystems,
  getGuidanceTypes,
  NONE_SCHEME_VALUE,
  normalizeSchemes,
  normalizeSelection
}
