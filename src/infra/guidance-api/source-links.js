import { guidanceApiClient } from './client.js'

/**
 * Ask the guidance API whether it takes a link as where an upload came from.
 *
 * @param {string} link - As the maintainer gave it
 * @returns {Promise<{ok: boolean, status: number, data: {canonicalLink: string|null, refusal: string|null}}>}
 * @throws {GuidanceApiError} - When the response is not ok
 */
async function checkSourceLink (link) {
  return guidanceApiClient.request('/guides/source-link-checks', {
    method: 'POST',
    body: { link }
  })
}

export {
  checkSourceLink
}
