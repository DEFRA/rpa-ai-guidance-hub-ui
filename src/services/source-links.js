import * as sourceLinksApi from '../infra/guidance-api/source-links.js'

/**
 * Why the hub refuses a link as where an upload came from, or null when it takes
 * it. The rule is the API's, so the UI never has a copy of it.
 *
 * @param {string} link - As the maintainer gave it
 * @returns {Promise<'not-sharepoint'|'not-a-word-document'|null>}
 */
async function refusalOf (link) {
  const { data } = await sourceLinksApi.checkSourceLink(link)

  return data.refusal
}

export {
  refusalOf
}
