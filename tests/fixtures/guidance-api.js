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

/**
 * A version as `GET /guides/{id}` and `GET /guides` send it.
 *
 * @param {Object} [overrides]
 * @returns {{id: string, contentUrl: string, title: string|null, createdBy: Object|null, createdAt: string}}
 */
function versionResponse (overrides = {}) {
  return {
    id: 'version-1',
    contentUrl: 's3://rpa-ai-guidance-hub-docs/guide-1/version-1/content.md',
    title: 'Claiming the SFI payment',
    createdBy: { id: 'dev-user-123', displayName: 'Dev User' },
    createdAt: '2026-10-06T08:00:00Z',
    ...overrides
  }
}

/**
 * Body of `GET /guides/{id}` on 200: a guide with its versions, newest
 * first.
 *
 * @param {Object} [overrides]
 * @returns {{id: string, metadata: Object, source: Object, versions: Array<Object>}}
 */
function guideResponse (overrides = {}) {
  return {
    id: 'guide-1',
    metadata: {
      guideTitle: 'Authored title',
      schemes: ['sfi'],
      systems: ['crm'],
      audience: ['processor'],
      owner: 'owner@example.com'
    },
    source: { uploadId: 'u-1', fileId: 'file-1', filename: 'guide.docx' },
    versions: [versionResponse()],
    ...overrides
  }
}

/**
 * One item of `GET /guides` on 200: a guide with only its latest version.
 *
 * @param {Object} [overrides]
 * @returns {{id: string, metadata: Object, source: Object, latestVersion: Object|null}}
 */
function guideSummaryResponse (overrides = {}) {
  const { versions, ...summary } = guideResponse()

  return { ...summary, latestVersion: versions[0], ...overrides }
}

/**
 * Body of `GET /guides` on 200.
 *
 * @param {Object} [overrides]
 * @returns {{items: Array<Object>, nextCursor: string|null}}
 */
function guidePageResponse (overrides = {}) {
  return { items: [guideSummaryResponse()], nextCursor: null, ...overrides }
}

export {
  guidePageResponse,
  guideResponse,
  guideSummaryResponse,
  versionResponse,
  schemesResponse,
  systemsResponse,
  audiencesResponse,
  stagedDocumentResponse,
  draftResponse,
  createdGuideResponse
}
