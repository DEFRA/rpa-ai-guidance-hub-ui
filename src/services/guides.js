import { SCHEME_YEAR } from '../constants/scheme-year.js'
import { statusCodes } from '../constants/status-codes.js'

import * as guidesApi from '../infra/guidance-api/guides.js'
import { schemesAsKept } from './reference-data.js'
import * as stagedDocumentsService from './staged-documents.js'

/**
 * A guide as a list shows it.
 *
 * @typedef {Object} GuideSummary
 * @property {string} id
 * @property {string|null} title - The latest version's title, else the
 *   title its author gave
 * @property {string|null} owner
 * @property {string[]} schemes
 * @property {string[]} systems
 * @property {string[]} audience
 * @property {string|null} lastUpdated - When the latest version was made
 */

/**
 * A version of a guide.
 *
 * @typedef {Object} GuideVersion
 * @property {string} id
 * @property {string|null} title
 * @property {{id: string, displayName: string|null}|null} createdBy
 * @property {string} createdAt
 */

/**
 * A guide with its versions.
 *
 * @typedef {Object} Guide
 * @property {string} id
 * @property {string|null} title
 * @property {Object} metadata - What the author said about the guide
 * @property {GuideVersion[]} versions - Newest first
 * @property {GuideVersion|null} latestVersion
 * @property {string|null} lastUpdated
 */

const RESULTS = {
  GUIDE_CREATED: 'guideCreated', // new, or the one this upload made before
  UPLOAD_EXPIRED: 'uploadExpired', // the API has no staged file for the upload
  PARSE_PENDING: 'parsePending', // the staged file has not finished parsing
  PARSE_FAILED: 'parseFailed' // the staged file could not be parsed
}

// The most guides the API lists on one page.
const LARGEST_PAGE = 100

const ALLOWED_ASSET_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp'
])

/**
 * Convert an upload into a guide, recording its answers and who made it.
 *
 * Only the user's id and display name are sent: the id is what anything
 * should match on, and the name is a copy so a listing can say who made a
 * version without asking a directory.
 *
 * @param {Object} guide
 * @param {string} guide.uploadId
 * @param {string} guide.fileId
 * @param {Object} guide.metadata - The journey's answers
 * @param {{id: string, displayName: string}} guide.user - The signed-in
 *   user's profile
 * @returns {Promise<{code: string}>} One of `RESULTS`
 */
async function createGuide ({ uploadId, fileId, metadata, user }) {
  const kept = metadata.schemes ? { ...metadata, schemes: schemesAsKept(metadata.schemes) } : metadata

  const res = await guidesApi.createGuide({
    source: { uploadId, fileId },
    // The scheme year is fixed, so the form does not send it.
    metadata: { ...kept, schemeYear: SCHEME_YEAR },
    createdBy: { id: user.id, displayName: user.displayName }
  })

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return { code: RESULTS.UPLOAD_EXPIRED }
  }

  if (res.status === statusCodes.HTTP_STATUS_CONFLICT) {
    return _whyNotParsed(fileId)
  }

  return { code: RESULTS.GUIDE_CREATED }
}

/**
 * The API refuses an unparsed file with one status whether its parse is
 * unfinished or failed, so ask the staged file which.
 *
 * @private
 * @param {string} fileId
 * @returns {Promise<{code: string}>}
 */
async function _whyNotParsed (fileId) {
  const stagedDocument = await stagedDocumentsService.getStagedDocumentById(fileId)

  if (!stagedDocument) {
    return { code: RESULTS.UPLOAD_EXPIRED }
  }

  if (stagedDocument.parsingStatus === 'failed') {
    return { code: RESULTS.PARSE_FAILED }
  }

  return { code: RESULTS.PARSE_PENDING }
}

/**
 * List guides, newest first, a page at a time.
 *
 * @param {Object} [filters] - As `guidesApi.listGuides`
 * @returns {Promise<{guides: GuideSummary[], nextCursor: string|null}>}
 * @throws {GuidanceApiError} - If the infra layer reports a failure
 */
async function listGuides (filters) {
  const res = await guidesApi.listGuides(filters)

  return {
    guides: res.data.items.map(item => _toSummary(item)),
    nextCursor: res.data.nextCursor ?? null,
    counts: res.data.counts ?? {}
  }
}

/**
 * Each filter's values, labelled as the reference data labels them, with how
 * many guides have each given the other filters chosen.
 *
 * @typedef {Object<string, Array<{label: string, shortLabel: string|null, count: number}>>} FilterCounts
 *   By the filter's name: `audience`, `system`, `scheme`
 */

/**
 * The hub's filters, by name, each with its chosen values.
 *
 * @typedef {{audience: string[], system: string[], scheme: string[]}} Filters
 */

/**
 * Every guide there is that the filters let through, in the order the API
 * lists them by the sort, following each page's cursor until the last. Pages
 * are as large as the API allows, to ask as few times as it can.
 *
 * @param {Object} [options]
 * @param {Filters} [options.filters]
 * @param {string} [options.sort] - `updated-newest` or `updated-oldest`
 * @returns {Promise<{guides: GuideSummary[], counts: FilterCounts}>} The
 *   counts are the same on every page, so the first page's are kept
 */
async function listEveryGuide ({ filters, sort } = {}) {
  const narrowing = filters
    ? { audiences: filters.audience, systems: filters.system, schemes: filters.scheme }
    : {}
  const guides = []
  let cursor
  let counts

  do {
    const page = await listGuides({ limit: LARGEST_PAGE, cursor, ...narrowing, ...(sort ? { sort } : {}) })

    guides.push(...page.guides)
    counts ??= page.counts
    cursor = page.nextCursor
  } while (cursor)

  return { guides, counts }
}

/**
 * Get a guide with its versions.
 *
 * @param {string} guideId
 * @returns {Promise<Guide|null>} The guide, or null if there is none
 * @throws {GuidanceApiError} - If the infra layer reports a non-404 failure
 */
async function getGuideById (guideId) {
  const res = await guidesApi.getGuide(guideId)

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return null
  }

  const versions = res.data.versions.map(version => _toVersion(version))
  const latestVersion = versions[0] ?? null

  return {
    id: res.data.id,
    title: _titleOf(latestVersion, res.data.metadata),
    metadata: res.data.metadata,
    versions,
    latestVersion,
    lastUpdated: latestVersion?.createdAt ?? null
  }
}

/**
 * Get the Markdown of a guide's latest version, as the API sends it. Its
 * asset links are relative to the API; a renderer resolves each with
 * `guideAssetHref`.
 *
 * @param {string} guideId
 * @returns {Promise<{markdown: string}|null>} The content, or null if
 *   there is no such guide or it has no versions
 * @throws {GuidanceApiError} - If the infra layer reports a non-404
 *   failure, such as a 502 when the recorded content is missing
 */
async function getGuideContent (guideId) {
  const res = await guidesApi.getGuideContent(guideId)

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return null
  }

  return { markdown: res.data }
}

/**
 * Get an image from a guide's content.
 *
 * @param {string} guideId
 * @param {string} name - The asset's file name
 * @returns {Promise<{body: Buffer, contentType: string}|null>} The image, or
 *   null if there is no such asset or it is not an image type we serve.
 *   Caching is for the caller to decide, not the API.
 * @throws {GuidanceApiError} - If the infra layer reports a non-404 failure
 */
async function getGuideAsset (guideId, name) {
  const res = await guidesApi.getGuideAsset(guideId, name)

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return null
  }

  const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase()

  if (!ALLOWED_ASSET_CONTENT_TYPES.has(contentType)) {
    return null
  }

  return { body: res.data, contentType }
}

/**
 * @private
 * @param {Object} item - A guide as the API lists it
 * @returns {GuideSummary}
 */
function _toSummary (item) {
  const { metadata = {}, latestVersion = null } = item

  return {
    id: item.id,
    title: _titleOf(latestVersion, metadata),
    owner: metadata.owner ?? null,
    schemes: metadata.schemes ?? [],
    systems: metadata.systems ?? [],
    audience: metadata.audience ?? [],
    lastUpdated: latestVersion?.createdAt ?? null
  }
}

/**
 * @private
 * @param {Object} version - A version as the API sends it
 * @returns {GuideVersion}
 */
function _toVersion (version) {
  return {
    id: version.id,
    title: version.title ?? null,
    createdBy: version.createdBy ?? null,
    createdAt: version.createdAt
  }
}

/**
 * @private
 * @param {{title?: string|null}|null} version
 * @param {{guideTitle?: string}} metadata
 * @returns {string|null}
 */
function _titleOf (version, metadata) {
  return version?.title ?? metadata?.guideTitle ?? null
}

export {
  createGuide,
  getGuideAsset,
  getGuideById,
  getGuideContent,
  listEveryGuide,
  listGuides,
  RESULTS
}
