/**
 * @module Search in one guide: the API says where the words are; the hub
 * never matches words itself.
 */

import * as guidesApi from '../infra/guidance-api/guides.js'
import { createLogger } from '../infra/logging/logger.js'
import { buildErrorLog } from '../infra/logging/utils/build-error-log.js'

const logger = createLogger()

/**
 * Where the words are in the guide, as the API answers it. Null when the
 * search cannot answer, which is logged: the guide shows all the same.
 *
 * @param {string} guideId
 * @param {string} words
 * @returns {Promise<{versionId: string, title: Array<Object>, sections: Array<{anchor: string|null, matches: Array<Object>}>}|null>}
 */
async function matchesInGuide (guideId, words) {
  try {
    const res = await guidesApi.searchGuide(guideId, words)

    return res.ok ? res.data : null
  } catch (err) {
    logger.warn(
      buildErrorLog(err, { type: 'guide_search_unavailable' }),
      `Could not search guide ${guideId}: ${err.message}`
    )

    return null
  }
}

export {
  matchesInGuide
}
