import * as referenceDataApi from '../infra/guidance-api/reference-data.js'

/**
 * ReferenceOption - a reference data value/label pair
 *
 * @typedef {Object} ReferenceOption
 * @property {string} value
 * @property {string} label
 */

/**
 * Fetch available schemes from the reference data service.
 *
 * @returns {Promise<ReferenceOption[]>}
 */
async function getSchemes () {
  const { data } = await referenceDataApi.getSchemes()

  return data
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

export {
  getSchemes,
  getAudiences,
  getSystems,
  getGuidanceTypes
}
