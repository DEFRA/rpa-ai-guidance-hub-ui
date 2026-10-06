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
 * Body of `GET /reference/systems` on 200.
 *
 * @param {Array<{value: string, label: string}>} [overrides] - Replaces the
 *   default option list entirely
 * @returns {Array<{value: string, label: string}>}
 */
function systemsResponse (overrides) {
  return overrides ?? [
    { value: 'crm', label: 'CRM' },
    { value: 'siti-agri', label: 'SITI Agri' }
  ]
}

/**
 * Body of `GET /reference/audiences` on 200.
 *
 * @param {Array<{value: string, label: string}>} [overrides] - Replaces the
 *   default option list entirely
 * @returns {Array<{value: string, label: string}>}
 */
function audiencesResponse (overrides) {
  return overrides ?? [
    { value: 'processor', label: 'Processor' },
    { value: 'team-leader', label: 'Team leader' }
  ]
}

/**
 * Body of `GET /guides/staging/{fileId}` on 200.
 *
 * Verified against `src/services/staged-documents.js#getStagedDocumentById`:
 * the guidance API returns raw (Python StrEnum) parsingStatus values -
 * 'pending' | 'in_progress' | 'complete' | 'failed' - not UI-style enum
 * strings.
 *
 * @param {Object} [overrides]
 * @returns {{fileId: string, parsingStatus: string, parsingError: string|null, title: string|null, version: string|null, lastModified: string|null}}
 */
function stagedDocumentResponse (overrides = {}) {
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

const draftResponse = stagedDocumentResponse

/**
 * Builds a mock guidance API `POST /guides` response: the document an
 * upload became, with its one version.
 *
 * @param {Object} [overrides]
 * @returns {{id: string, metadata: Object, source: Object, versions: Array<Object>}}
 */
function createdGuideResponse (overrides = {}) {
  return {
    id: 'document-1',
    metadata: {},
    source: { uploadId: 'u-check', fileId: 'file-1', filename: null },
    versions: [
      {
        id: 'version-1',
        contentUrl: 's3://rpa-ai-guidance-hub-docs/document-1/version-1/guide.md',
        title: null,
        createdBy: { id: 'dev-user-123', displayName: 'Dev User' },
        createdAt: '2026-10-06T08:00:00Z'
      }
    ],
    ...overrides
  }
}

export {
  schemesResponse,
  systemsResponse,
  audiencesResponse,
  stagedDocumentResponse,
  draftResponse,
  createdGuideResponse
}
