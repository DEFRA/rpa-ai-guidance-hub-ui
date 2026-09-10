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

export {
  schemesResponse
}
