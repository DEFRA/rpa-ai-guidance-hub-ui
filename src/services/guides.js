import { SCHEME_YEAR } from '../constants/scheme-year.js'
import { statusCodes } from '../constants/status-codes.js'

import * as guidesApi from '../infra/guidance-api/guides.js'
import { createLogger } from '../infra/logging/logger.js'
import { buildErrorLog } from '../infra/logging/utils/build-error-log.js'
import { findHeading, splitIntoSections } from './guide-sections.js'
import { NOT_SCHEME_SPECIFIC, schemesAsKept } from './reference-data.js'
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
 * @property {string|null} purpose - What the guide is for, as its author
 *   said (`goal`)
 * @property {string|null} versionNumber - The latest version's, as its author
 *   gave it
 * @property {string|null} lastUpdated - When the latest version was made
 * @property {string|null} createdAt - When the guide was recorded, which is
 *   when it went live, since every upload does
 */

/**
 * A version of a guide.
 *
 * @typedef {Object} GuideVersion
 * @property {string} id
 * @property {string|null} title
 * @property {string|null} versionNumber - As its author gave it (`1.0`);
 *   null for a version made before versions had numbers
 * @property {{id: string, displayName: string|null}|null} createdBy
 * @property {string} createdAt
 * @property {string|null} sourceLink - Where the maintainer said its document
 *   came from, as they gave it; null when they gave none
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

const logger = createLogger()

const RESULTS = {
  SAVE_STARTED: 'saveStarted', // accepted: the guide is saving in the background
  GUIDE_CREATED: 'guideCreated', // the one this upload made before
  UPLOAD_EXPIRED: 'uploadExpired', // the API has no staged file for the upload
  PARSE_PENDING: 'parsePending', // the staged file has not finished parsing
  PARSE_FAILED: 'parseFailed', // the staged file could not be parsed
  REPLACED_FIRST: 'replacedFirst', // the guide has a newer version than the one replaced
  KEPT_FOR_ANOTHER: 'keptForAnother' // the staged file is kept for what was chosen first
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
 * The version number is one of the journey's answers, but the API keeps it
 * on the version beside the guide's details rather than among them, since
 * the hub reads it.
 *
 * @param {Object} guide
 * @param {string} guide.uploadId
 * @param {string} guide.fileId
 * @param {Object} guide.metadata - The journey's answers, the version number
 *   among them
 * @param {{id: string, displayName: string}} guide.user - The signed-in
 *   user's profile
 * @returns {Promise<{code: string}>} One of `RESULTS`
 */
async function createGuide (guide) {
  return _convert(guide, guidesApi.createGuide, () => _whyFileRefused(guide.fileId))
}

/**
 * Convert an upload into a new version of a guide, which replaces the version
 * named: the same request as `createGuide` makes, answered the same way, but
 * refused when the guide has a newer version than the one it replaces.
 *
 * @param {string} guideId - The guide the upload is a new version of
 * @param {Object} version - As `createGuide` takes a guide, with
 *   `replacesVersionId`: the guide's latest version when it was chosen
 * @returns {Promise<{code: string}>} One of `RESULTS`
 */
async function createVersion (guideId, version) {
  const { replacesVersionId } = version

  return _convert(
    version,
    (request) => guidesApi.createVersion(guideId, { ...request, replacesVersionId }),
    () => _whyVersionRefused(guideId, replacesVersionId, version.fileId)
  )
}

/**
 * @private
 * @param {Object} upload - As `createGuide` takes it
 * @param {(request: Object) => Promise<{status: number}>} send - The API
 *   call that converts it
 * @param {() => Promise<{code: string}>} whyConflict - Which of the API's
 *   reasons for a conflict it was
 * @returns {Promise<{code: string}>} One of `RESULTS`
 */
async function _convert ({ uploadId, fileId, metadata, user }, send, whyConflict) {
  const { versionNumber, guideTitle, sourceLink, ...details } = metadata
  const kept = details.schemes ? { ...details, schemes: schemesAsKept(details.schemes) } : details

  const res = await send({
    source: { uploadId, fileId },
    // The scheme year is fixed, so the form does not send it.
    metadata: { ...kept, schemeYear: SCHEME_YEAR },
    // Each version keeps its own title and source link, outside the guide's details.
    title: guideTitle,
    versionNumber,
    ...(sourceLink ? { sourceLink } : {}),
    createdBy: { id: user.id, displayName: user.displayName }
  })

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return { code: RESULTS.UPLOAD_EXPIRED }
  }

  if (res.status === statusCodes.HTTP_STATUS_CONFLICT) {
    return whyConflict()
  }

  if (res.status === statusCodes.HTTP_STATUS_ACCEPTED) {
    return { code: RESULTS.SAVE_STARTED }
  }

  return { code: RESULTS.GUIDE_CREATED }
}

/**
 * The API refuses a new version with one status whether the guide has a newer
 * version than the one it replaces or the file cannot be made into it, so ask
 * the guide which.
 *
 * @private
 * @param {string} guideId
 * @param {string} replacesVersionId
 * @param {string} fileId
 * @returns {Promise<{code: string}>}
 */
async function _whyVersionRefused (guideId, replacesVersionId, fileId) {
  const guide = await getGuideById(guideId)

  if (guide?.latestVersion?.id !== replacesVersionId) {
    return { code: RESULTS.REPLACED_FIRST }
  }

  return _whyFileRefused(fileId, guideId)
}

/**
 * The API refuses a file with one status whether its parse is unfinished or
 * failed, or it is kept for another guide, so ask the staged file which. The
 * API keeps a file for the guide first submitted, even when that submission
 * failed, so a file kept for another guide cannot be made into this one.
 *
 * @private
 * @param {string} fileId
 * @param {string|null} [guideId] - The guide it is a new version of; null for
 *   a new guide
 * @returns {Promise<{code: string}>}
 */
async function _whyFileRefused (fileId, guideId = null) {
  const stagedDocument = await stagedDocumentsService.getStagedDocumentById(fileId)

  if (!stagedDocument) {
    return { code: RESULTS.UPLOAD_EXPIRED }
  }

  if (stagedDocument.documentId && stagedDocument.documentId !== guideId) {
    return { code: RESULTS.KEPT_FOR_ANOTHER }
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
    guides: res.data.items.map(item => toGuideSummary(item)),
    nextCursor: res.data.nextCursor ?? null,
    counts: res.data.counts ?? {}
  }
}

/**
 * Each filter's values, labelled as the reference data labels them, with how
 * many guides have each given the other filters chosen.
 *
 * @typedef {Object<string, Array<{label: string|null, shortLabel: string|null, count: number, retired: boolean}>>} FilterCounts
 *   By the filter's name: `audience`, `system`, `scheme`. A retired value is
 *   one the reference data no longer has: counted, but not a choice
 */

/**
 * The hub's filters, by name, each with its chosen values.
 *
 * @typedef {{audience: string[], system: string[], scheme: string[], noScheme?: boolean}} Filters
 *   `noScheme` chooses the guides specific to no scheme too
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
    ? { audiences: filters.audience, systems: filters.system, schemes: filters.scheme, noScheme: filters.noScheme }
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
 * The heading at an anchor in a guide's latest version, with the page it is
 * on.
 *
 * @param {string} guideId
 * @param {string} anchor
 * @returns {Promise<{anchor: string, title: string, page: number}|null>} Null
 *   when there is no such guide, or it has no heading there
 * @throws {GuidanceApiError} - If the infra layer reports a non-404 failure
 */
async function headingOf (guideId, anchor) {
  const content = await getGuideContent(guideId)

  return content ? findHeading(splitIntoSections(content.markdown), anchor) : null
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
 * @param {Object} item - A guide as the API lists it
 * @returns {GuideSummary}
 */
function toGuideSummary (item) {
  const { metadata = {}, latestVersion = null } = item

  return {
    id: item.id,
    title: _titleOf(latestVersion, metadata),
    owner: metadata.owner ?? null,
    schemes: metadata.schemes ?? [],
    systems: metadata.systems ?? [],
    audience: metadata.audience ?? [],
    purpose: metadata.goal ?? null,
    versionNumber: latestVersion?.versionNumber ?? null,
    lastUpdated: latestVersion?.createdAt ?? null,
    createdAt: item.createdAt ?? null
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
    versionNumber: version.versionNumber ?? null,
    createdBy: version.createdBy ?? null,
    createdAt: version.createdAt,
    sourceLink: version.sourceLink ?? null
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

/**
 * A guide's details as the upload journey's answers, for a new version of it
 * to start with: only the details the journey asks, as check answers refuses
 * any other, and all but the title, which starts as the uploaded file's, and
 * the version number, which each version's author gives. A guide kept with no
 * scheme is not scheme-specific.
 *
 * @param {Guide} guide
 * @returns {Object}
 */
function answersOf ({ metadata }) {
  const { schemes, owner, goal, requirements, systems, audience } = metadata

  return {
    schemes: schemes?.length === 0 ? [NOT_SCHEME_SPECIFIC] : schemes,
    owner,
    goal,
    requirements,
    systems,
    audience
  }
}

/**
 * The guides with titles like the words, the likest first: none for no words.
 * Null when the search cannot answer, which is logged: a choice that needs no
 * search can still be made.
 *
 * @param {string} words
 * @returns {Promise<Array<{guideId: string, title: string}>|null>}
 */
async function guidesTitledLike (words) {
  if (!words) {
    return []
  }

  try {
    const res = await guidesApi.findGuidesByTitle(words)

    return res.data.items
  } catch (err) {
    logger.warn(
      buildErrorLog(err, { type: 'guide_title_search_unavailable' }),
      `Could not search the guides' titles: ${err.message}`
    )

    return null
  }
}

export {
  answersOf,
  guidesTitledLike,
  createGuide,
  createVersion,
  getGuideAsset,
  getGuideById,
  getGuideContent,
  headingOf,
  listEveryGuide,
  listGuides,
  RESULTS,
  toGuideSummary
}
