/**
 * guidance API response bodies.
 *
 * Single owner of every response shape the guidance API sends, so that no
 * two tests can disagree about what upstream actually returns. Each factory
 * returns a fresh array - nothing here is shared mutable state.
 *
 * Verified against `src/infra/guidance-api/client.js#request`: it returns
 * `{ok, status, data}` where `data` is the parsed response body untouched -
 * a plain array of `{value, label}` reference options, not wrapped in an
 * envelope.
 */

/**
 * Body of `GET /reference/schemes` on 200.
 *
 * @param {Array<{value: string, label: string}>} [overrides] - Replaces the
 *   default option list entirely
 * @returns {Array<{value: string, label: string}>}
 */
function schemesResponse (overrides) {
  return overrides ?? [
    { value: 'sfi', label: 'Sustainable Farming Incentive (SFI)' },
    { value: 'countryside-stewardship', label: 'Countryside Stewardship (CS)' }
  ]
}

/**
 * Body of `GET /guidance/drafts/{fileId}` on 200.
 *
 * Verified against `src/services/drafts.js#getDraftById`: the guidance API
 * returns raw (Python StrEnum) parsingStatus values - 'pending' |
 * 'in_progress' | 'complete' | 'failed' - not UI-style enum strings.
 *
 * @param {Object} [overrides]
 * @returns {{fileId: string, parsingStatus: string, parsingError: string|null, title: string|null, version: string|null, lastModified: string|null}}
 */
function draftResponse (overrides = {}) {
  return {
    fileId: 'file-1',
    parsingStatus: 'pending',
    parsingError: null,
    title: null,
    version: null,
    lastModified: null,
    ...overrides
  }
}

export {
  schemesResponse,
  draftResponse
}
