import * as referenceDataApi from '../infra/guidance-api/reference-data.js'

/**
 * ReferenceOption - a reference data option
 *
 * The label is the option's identity: it is what the session stores, the
 * schemas validate against and the guidance API is sent. The short label is
 * display-only, for places where the full label is too long; it falls back to
 * the label when the API has none.
 *
 * @typedef {Object} ReferenceOption
 * @property {string} label
 * @property {string} shortLabel
 */

/**
 * Build a ReferenceOption from an API option, defaulting the short label.
 *
 * @param {{label: string, shortLabel?: string}} option
 * @returns {ReferenceOption}
 * @private
 */
function toReferenceOption ({ label, shortLabel }) {
  return { label, shortLabel: shortLabel ?? label }
}

/**
 * Label of the "Not scheme-specific" opt-out choice for the "which scheme
 * does this guidance relate to?" question. It's not a scheme the guidance
 * API itself knows about, but `getSchemes` always appends it below so every
 * caller - building the checkbox list, validating a submitted selection -
 * sees one consistent set of valid schemes.
 *
 * Reference options are identified by label end to end: the API defines them,
 * the session stores them and the guidance API is sent them. Shaping them for a
 * form is a view concern (see `toCheckboxOptions` in view-helpers.js).
 */
const NOT_SCHEME_SPECIFIC = 'Not scheme-specific'

/**
 * Fetch available schemes from the reference data service, plus the
 * "Not scheme-specific" opt-out choice (see NOT_SCHEME_SPECIFIC above), which
 * always belongs alongside them however this list is used.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getSchemes () {
  const { data } = await referenceDataApi.getSchemes()

  return [...data.map(toReferenceOption), toReferenceOption({ label: NOT_SCHEME_SPECIFIC })]
}

/**
 * Fetch available audiences from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getAudiences () {
  const { data } = await referenceDataApi.getAudiences()

  return data.map(toReferenceOption)
}

/**
 * Fetch available systems from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getSystems () {
  const { data } = await referenceDataApi.getSystems()

  return data.map(toReferenceOption)
}

/**
 * Fetch available guidance types from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getGuidanceTypes () {
  const { data } = await referenceDataApi.getGuidanceTypes()

  return data.map(toReferenceOption)
}

/**
 * Normalize a submitted `schemes` field so "None" is mutually exclusive with
 * every other scheme: selecting "Not scheme-specific" alone is a valid, self-contained
 * selection; selecting any other scheme alongside it drops it.
 *
 * Unlike the getters above, this isn't a fetch wrapper - it's the one
 * scheme-specific business rule callers need, kept here because it depends
 * on the same `NOT_SCHEME_SPECIFIC` this module owns.
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
  const specificSchemes = schemes.filter((scheme) => scheme !== NOT_SCHEME_SPECIFIC)

  if (specificSchemes.length > 0) {
    return specificSchemes
  }

  return schemes.includes(NOT_SCHEME_SPECIFIC) ? [NOT_SCHEME_SPECIFIC] : []
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
  NOT_SCHEME_SPECIFIC,
  normalizeSchemes,
  normalizeSelection
}
