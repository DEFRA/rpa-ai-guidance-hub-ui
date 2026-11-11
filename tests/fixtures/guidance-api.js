/**
 * guidance API response bodies.
 *
 * Single owner of every response shape the guidance API sends, so that no
 * two tests can disagree about what upstream actually returns. Each factory
 * returns a fresh array - nothing here is shared mutable state. A test stubs a
 * response with a factory from here, adding one for a new response, including
 * a test brought from another branch: lint refuses a body of its own. Guide and
 * version ids here are readable stand-ins: the API's are UUIDs.
 *
 * Verified against `src/infra/guidance-api/client.js#request`: it returns
 * `{ok, status, data}` where `data` is the parsed response body untouched -
 * a plain array of `{label, shortLabel?}` reference options, not wrapped in an
 * envelope.
 */

/**
 * Body of `GET /reference/schemes` on 200.
 *
 * @param {Array<{label: string, shortLabel?: string}>} [overrides] - Replaces the
 *   default option list entirely
 * @returns {Array<{label: string, shortLabel?: string}>}
 */
function schemesResponse (overrides) {
  return overrides ?? [
    { label: 'Sustainable Farming Incentive (SFI)', shortLabel: 'SFI' },
    { label: 'Countryside Stewardship (CS)' }
  ]
}

/**
 * Body of `GET /reference/systems` on 200.
 *
 * @param {Array<{label: string, shortLabel?: string}>} [overrides] - Replaces the
 *   default option list entirely
 * @returns {Array<{label: string, shortLabel?: string}>}
 */
function systemsResponse (overrides) {
  return overrides ?? [
    { label: 'CRM' },
    { label: 'SITI Agri' }
  ]
}

/**
 * Body of `GET /reference/audiences` on 200.
 *
 * @param {Array<{label: string, shortLabel?: string}>} [overrides] - Replaces the
 *   default option list entirely
 * @returns {Array<{label: string, shortLabel?: string}>}
 */
function audiencesResponse (overrides) {
  return overrides ?? [
    { label: 'Processor' },
    { label: 'Team leader' }
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
 * Verified against OpenAPI schema on 2026-10-12: contains id, contentUrl,
 * title, createdBy, and createdAt. The API adds versionNumber, as the author
 * gave it, null for a version made before versions had one.
 *
 * @param {Object} [overrides]
 * @returns {{id: string, contentUrl: string, title: string|null, versionNumber: string|null, createdBy: Object|null, createdAt: string}}
 */
function versionResponse (overrides = {}) {
  return {
    id: 'version-1',
    contentUrl: 's3://rpa-ai-guidance-hub-docs/guide-1/version-1/content.md',
    title: 'Claiming the SFI payment',
    versionNumber: '1.0',
    createdBy: { id: 'dev-user-123', displayName: 'Dev User' },
    createdAt: '2026-10-06T08:00:00Z',
    ...overrides
  }
}

/**
 * Body of `GET /guides/{id}` on 200: a guide with its versions, newest
 * first.
 *
 * Verified against OpenAPI schema on 2026-10-12: returns id, metadata,
 * source, and versions array ordered newest first. The API adds createdAt,
 * when the guide was recorded.
 *
 * @param {Object} [overrides]
 * @returns {{id: string, metadata: Object, source: Object, createdAt: string, versions: Array<Object>}}
 */
function guideResponse (overrides = {}) {
  return {
    id: 'guide-1',
    metadata: {
      guideTitle: 'Authored title',
      schemes: ['Sustainable Farming Incentive (SFI)'],
      systems: ['CRM'],
      audience: ['Processor'],
      owner: 'owner@example.com'
    },
    source: { uploadId: 'u-1', fileId: 'file-1', filename: 'guide.docx' },
    createdAt: '2026-10-01T09:00:00',
    versions: [versionResponse()],
    ...overrides
  }
}

/**
 * One item of `GET /guides` on 200: a guide with only its latest version.
 *
 * Verified against OpenAPI schema on 2026-10-12: guide representation
 * including id, metadata, source, and latestVersion.
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
 * Verified against OpenAPI schema on 2026-10-12: paginated response
 * containing items array and nextCursor string or null.
 *
 * @param {Object} [overrides]
 * @returns {{items: Array<Object>, nextCursor: string|null}}
 */
function guidePageResponse (overrides = {}) {
  return { items: [guideSummaryResponse()], nextCursor: null, ...overrides }
}

/**
 * Body of `POST /users` (201, or 200 for a user signed in before) and of
 * `GET /users/{id}` on 200: the hub's user, with the guides and sections they
 * have pinned (`pinResponse`), in their order, and their cases
 * (`caseResponse`), in their order. By default the dev user `loginAsDevUser`
 * signs in, with nothing pinned and no cases.
 *
 * Verified against the guidance API's `User` schema on 2026-11-08: id,
 * identity, displayName, createdAt, pinned as `PinInBrief` items, and cases
 * as `CaseInBrief` items.
 *
 * @param {Object} [overrides]
 * @returns {{id: string, identity: {tenantId: string, objectId: string}, displayName: string|null, createdAt: string, pinned: Array<{id: string, title: string|null}>, cases: Array<object>}}
 */
function userResponse (overrides = {}) {
  return {
    id: '01a18d45-0000-7000-8000-000000000001',
    identity: { tenantId: 'local-development', objectId: 'dev-user-123' },
    displayName: 'Dev User',
    createdAt: '2026-10-06T08:00:00Z',
    pinned: [],
    cases: [],
    ...overrides
  }
}

/**
 * One of `GET /users/{id}`'s pins: a guide the user has pinned, or a section of
 * one, with the guide's title. By default the whole guide `guideResponse`
 * makes, with no section.
 *
 * Verified against the guidance API's `PinInBrief` schema on 2026-11-08: id,
 * title, and sectionId, section and heading, each null for a whole guide.
 *
 * @param {Object} [overrides]
 * @returns {{id: string, title: string|null, sectionId: string|null, section: string|null, heading: string|null}}
 */
function pinResponse (overrides = {}) {
  return {
    id: 'guide-1',
    title: 'Claiming the SFI payment',
    sectionId: null,
    section: null,
    heading: null,
    ...overrides
  }
}

/**
 * One of `GET /users/{id}`'s cases: a case the user has bookmarked sections of
 * guides to. Its key names it wherever its reference must not go; its guides
 * come in the order first bookmarked, each with its bookmarked sections in the
 * guide's order, and each section's position among the case's bookmarks. By
 * default case W1234567, with nothing bookmarked to it.
 *
 * Verified against the guidance API's `CaseInBrief` schema on 2026-11-08: key,
 * type (`case` or `sbi`), ref, and guides as `{id, title, bookmarks}` items,
 * each bookmark `{sectionId, section, heading, position}`.
 *
 * @param {Object} [overrides]
 * @returns {{key: string, type: string, ref: string, guides: Array<{id: string, title: string|null, bookmarks: Array<{sectionId: string, section: string|null, heading: string|null, position: number}>}>}}
 */
function caseResponse (overrides = {}) {
  return {
    key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    type: 'case',
    ref: 'W1234567',
    guides: [],
    ...overrides
  }
}

/**
 * One item of `GET /users/{id}/pins`: a pin, with its guide as `GET /guides`
 * lists it, its position among all the user's pins and, for a section, the
 * section's id, anchor and heading. By default a whole guide, first.
 *
 * Verified on 2026-11-08 by validating this item, with UUIDs for its ids,
 * against the guidance API's `PinnedSummary` schema, as a whole guide and as
 * a section.
 *
 * @param {Object} [overrides]
 * @returns {Object}
 */
function pinnedSummaryResponse (overrides = {}) {
  return guideSummaryResponse({ position: 0, sectionId: null, section: null, heading: null, ...overrides })
}

/**
 * Body of `GET /users/{id}/pins` on 200: the user's pins, guides and sections
 * of guides, in their order (`pinnedSummaryResponse`), and each filter's
 * counts among their guides. By default one pinned guide, and no counts.
 *
 * Verified against the guidance API's `Pinned` schema on 2026-11-05: items as
 * `PinnedSummary`, and counts of `OptionCount` by filter.
 *
 * @param {Object} [overrides]
 * @returns {{items: Array<Object>, counts: Object<string, Array<Object>>}}
 */
function pinnedGuidesResponse (overrides = {}) {
  return {
    items: [pinnedSummaryResponse()],
    counts: { audience: [], system: [], scheme: [] },
    ...overrides
  }
}

/**
 * Body of `GET /users/{id}/recently-opened` on 200: the guides the user opened
 * most recently, newest first, each as `GET /guides` lists it with when they
 * last opened it, and each filter's counts among them. By default one guide,
 * and no counts.
 *
 * Verified on 2026-11-05 by validating this body, with UUIDs for its ids,
 * against the guidance API's `RecentlyOpened` schema: items as
 * `RecentlyOpenedSummary`, and counts of `OptionCount` by filter.
 *
 * @param {Object} [overrides]
 * @returns {{items: Array<Object>, counts: Object<string, Array<Object>>}}
 */
function recentlyOpenedResponse (overrides = {}) {
  return {
    items: [guideSummaryResponse({ openedAt: '2026-11-03T17:00:00' })],
    counts: { audience: [], system: [], scheme: [] },
    ...overrides
  }
}

/**
 * Body of `GET /users/{id}/bookmarked-guides` on 200: the guides bookmarked to
 * the user's cases, each once, in the order of the cases, each as `GET /guides`
 * lists it, and each filter's counts among them. By default one guide, and no
 * counts.
 *
 * Verified on 2026-11-10 by validating this body, with UUIDs for its ids,
 * against the guidance API's `BookmarkedGuides` schema: items as
 * `DocumentSummary`, and counts of `OptionCount` by filter.
 *
 * @param {Object} [overrides]
 * @returns {{items: Array<Object>, counts: Object<string, Array<Object>>}}
 */
function bookmarkedGuidesResponse (overrides = {}) {
  return {
    items: [guideSummaryResponse()],
    counts: { audience: [], system: [], scheme: [] },
    ...overrides
  }
}

/**
 * Body of a request the guidance API refuses itself: why, in words.
 *
 * Verified against the running API on 2026-11-05: `detail` as a string, unlike
 * FastAPI's own validation, which answers `detail` as a list.
 *
 * @param {Object} [overrides]
 * @returns {{detail: string}}
 */
function refusalResponse (overrides = {}) {
  return { detail: 'Refused', ...overrides }
}

export {
  bookmarkedGuidesResponse,
  caseResponse,
  guidePageResponse,
  guideResponse,
  guideSummaryResponse,
  pinnedGuidesResponse,
  pinnedSummaryResponse,
  pinResponse,
  recentlyOpenedResponse,
  refusalResponse,
  versionResponse,
  schemesResponse,
  systemsResponse,
  audiencesResponse,
  stagedDocumentResponse,
  draftResponse,
  createdGuideResponse,
  userResponse
}
