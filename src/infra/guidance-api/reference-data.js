import { guidanceApiClient } from './client.js'

/**
 * Fetch scheme reference options ("Which scheme does this guidance relate to?")
 *
 * @returns {Promise<{ok: boolean, status: number, data: Array<{value: string, label: string}>}>}
 * @throws {GuidanceApiError} - When response is not ok
 */
async function getSchemes () {
  return guidanceApiClient.request('/reference/schemes')
}

/**
 * Fetch audience reference options ("Who is this for?")
 *
 * @returns {Promise<{ok: boolean, status: number, data: Array<{value: string, label: string}>}>}
 * @throws {GuidanceApiError} - When response is not ok
 */
async function getAudiences () {
  return guidanceApiClient.request('/reference/audiences')
}

/**
 * Fetch system reference options ("What systems does this guidance relate to?")
 *
 * @returns {Promise<{ok: boolean, status: number, data: Array<{value: string, label: string}>}>}
 * @throws {GuidanceApiError} - When response is not ok
 */
async function getSystems () {
  return guidanceApiClient.request('/reference/systems')
}

/**
 * Fetch guidance type reference options
 *
 * @returns {Promise<{ok: boolean, status: number, data: Array<{value: string, label: string}>}>}
 * @throws {GuidanceApiError} - When response is not ok
 */
async function getGuidanceTypes () {
  return guidanceApiClient.request('/reference/guidance-types')
}

export {
  getSchemes,
  getAudiences,
  getSystems,
  getGuidanceTypes
}
