import { statusCodes } from '../constants/status-codes.js'
import * as guidesApi from '../infra/guidance-api/guides.js'
import { getStagedDocumentById } from './staged-documents.js'

const RESULTS = {
  GUIDE_CREATED: 'guideCreated', // new, or the one this upload made before
  UPLOAD_EXPIRED: 'uploadExpired', // the API has no staged file for the upload
  PARSE_PENDING: 'parsePending', // the staged file has not finished parsing
  PARSE_FAILED: 'parseFailed' // the staged file could not be parsed
}

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
  const res = await guidesApi.createGuide({
    source: { uploadId, fileId },
    metadata,
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
  const stagedDocument = await getStagedDocumentById(fileId)

  if (!stagedDocument) {
    return { code: RESULTS.UPLOAD_EXPIRED }
  }

  if (stagedDocument.parsingStatus === 'failed') {
    return { code: RESULTS.PARSE_FAILED }
  }

  return { code: RESULTS.PARSE_PENDING }
}

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
    nextCursor: res.data.nextCursor ?? null
  }
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
 * Get a guide's versions, newest first.
 *
 * @param {string} guideId
 * @returns {Promise<GuideVersion[]|null>} The versions, or null if there is
 *   no such guide
 * @throws {GuidanceApiError} - If the infra layer reports a non-404 failure
 */
async function getGuideVersions (guideId) {
  const guide = await getGuideById(guideId)

  return guide ? guide.versions : null
}

/**
 * Get the Markdown of a guide's latest version, its images pointing at the
 * UI's own asset route.
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

  return { markdown: _rewriteAssetLinks(res.data, guideId) }
}

/**
 * Get an image from a guide's content.
 *
 * @param {string} guideId
 * @param {string} name - The asset's file name
 * @returns {Promise<{body: Buffer, contentType: string, cacheControl:
 *   string|null}|null>} The image, or null if there is no such asset
 * @throws {GuidanceApiError} - If the infra layer reports a non-404 failure
 */
async function getGuideAsset (guideId, name) {
  const res = await guidesApi.getGuideAsset(guideId, name)

  if (res.status === statusCodes.HTTP_STATUS_NOT_FOUND) {
    return null
  }

  return {
    body: res.data,
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    cacheControl: res.headers.get('cache-control')
  }
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

/**
 * The content names an image `../assets/<name>`; the browser can only reach
 * the guide's assets by the UI's route.
 *
 * @private
 * @param {string} markdown
 * @param {string} guideId
 * @returns {string}
 */
function _rewriteAssetLinks (markdown, guideId) {
  const base = `/guides/${encodeURIComponent(guideId)}/assets/`

  return markdown.replaceAll(/\]\(\.\.\/assets\/([A-Za-z0-9]+\.[A-Za-z0-9]+)\)/g, `](${base}$1)`)
}

export {
  createGuide,
  getGuideAsset,
  getGuideById,
  getGuideContent,
  getGuideVersions,
  listGuides,
  RESULTS
}
