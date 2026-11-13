import { CASE_TYPES } from '../../constants/case-types.js'
import { bookmarkedSections } from '../../services/case-bookmarks.js'
import { NOT_SCHEME_SPECIFIC } from '../../services/reference-data.js'
import { caseGuidesHref } from '../common/case-guides-href.js'
import { formatIsoDate } from '../common/format-date.js'
import { versionTag } from '../common/version-tag.js'
import { READING_WIDTHS } from './reading-width.js'

const UNTITLED = 'Untitled guide'

/**
 * @typedef {Object} MetadataRow
 * @property {string} label
 * @property {string} text
 * @property {string} href - Always a `mailto:` link for the owner's email address
 */

/**
 * @private
 * @param {string[]} values
 * @returns {string}
 */
function _list (values) {
  return values.join(', ')
}

/**
 * The "About this guide" rows: only the ones the guide has answers for.
 *
 * @param {Object} metadata - What the guide's author said about it. The
 *   API sends the scheme, audience and system fields as display labels.
 * @returns {MetadataRow[]}
 */
function buildMetadataRows (metadata = {}) {
  return [
    _schemesRow(metadata.schemes),
    _listRow("Who it's for", metadata.audience),
    _listRow('Systems used', metadata.systems),
    _textRow('Purpose', metadata.goal),
    _textRow('Required knowledge', metadata.requirements),
    _ownerRow(metadata.owner)
  ].filter(Boolean)
}

/**
 * @private
 * @param {string} label
 * @param {string[]} [values]
 * @returns {MetadataRow|null} Null when there are no values
 */
function _listRow (label, values) {
  return values?.length > 0 ? { label, text: _list(values) } : null
}

/**
 * @private
 * @param {string[]} [schemes]
 * @returns {MetadataRow|null} "Not scheme-specific" for a guide with none,
 *   which is what it was uploaded as; null when it does not say
 */
function _schemesRow (schemes) {
  return schemes?.length === 0
    ? { label: 'Scheme', text: NOT_SCHEME_SPECIFIC }
    : _listRow('Scheme', schemes)
}

/**
 * @private
 * @param {string} label
 * @param {string} [text]
 * @returns {MetadataRow|null} Null when there is no text
 */
function _textRow (label, text) {
  return text ? { label, text } : null
}

/**
 * @private
 * @param {string} [owner]
 * @returns {MetadataRow|null} Null when there is no owner
 */
function _ownerRow (owner) {
  if (!owner) {
    return null
  }

  return {
    label: 'Owner',
    text: owner,
    href: `mailto:${encodeURIComponent(owner)}`
  }
}

/**
 * @private
 * A section just bookmarked, as the message that confirms it says so, with
 * the address of the Bookmarked guides page narrowed to the case, found among
 * the user's by its type and reference.
 *
 * @param {{type: string, ref: string, heading: string}} bookmarked
 * @param {Array<{key: string, type: string, ref: string}>} cases - The user's
 * @returns {{text: string, caseHref: string|null, caseName: string}} `caseHref` null when the
 *   case is not among them, as when it was removed since
 */
function _bookmarkAdded (bookmarked, cases) {
  const found = cases.find(({ type, ref }) => type === bookmarked.type && ref === bookmarked.ref)

  return {
    text: `‘${bookmarked.heading}’ bookmarked to ${CASE_TYPES[bookmarked.type].lower} ${bookmarked.ref}`,
    caseHref: found ? caseGuidesHref(found.key) : null,
    caseName: `${CASE_TYPES[bookmarked.type].short} ${bookmarked.ref}`
  }
}

/**
 * GuideViewModel - One section of a guide, with the page furniture around
 * it: byline, contents, previous and next links, and the "About this
 * guide" rows.
 */
class GuideViewModel {
  /**
   * @param {Object} data
   * @param {import('../../services/guides.js').Guide} data.guide
   * @param {import('../../services/guide-sections.js').GuideSection[]} data.sections
   * @param {number} data.pageNumber - Already within 1..sections.length
   * @param {string} data.readingWidth
   * @param {string} data.returnTo - Where the width form sends the user back to
   * @param {MetadataRow[]} data.metadataRows
   * @param {boolean} [data.panelCollapsed] - Whether the "About this guide"
   *   panel is folded away to its rail
   * @param {{pinned: boolean, position: number|null}|null} [data.pin] - The
   *   guide among the user's pins, for its Pin guide button; null when not known
   * @param {Map<string, {position: number, sectionId: string, key: string}>|null} [data.pinnedSections]
   *   - The guide's sections among the user's pins, by anchor, for each
   *   heading's star; null when not known
   * @param {Array<object>|null} [data.cases] - The user's, each with the
   *   sections bookmarked to it; null when not known
   * @param {{guideId: string, type: string, ref: string, heading: string}} [data.bookmarked]
   *   - A section just bookmarked, to say so once
   */
  constructor ({ guide, sections, pageNumber, readingWidth, returnTo, metadataRows, panelCollapsed = false, pin = null, pinnedSections = null, cases = null, bookmarked }) {
    const href = page => GuideViewModel.pageHref(guide.id, page)
    const adjacent = (page) => {
      const section = sections[page - 1]

      return section ? { href: href(page), labelText: section.title } : null
    }

    this.guideId = guide.id
    this.title = guide.title ?? UNTITLED
    this.version = versionTag(guide.latestVersion?.versionNumber)
    this.lastUpdated = formatIsoDate(guide.lastUpdated)
    this.sections = sections
    this.section = sections[pageNumber - 1] ?? null
    this.pageNumber = pageNumber
    this.totalPages = sections.length
    // How far through the guide the reader is, by page count.
    this.progressPercentage = sections.length === 0 ? 0 : Math.round(pageNumber / sections.length * 100)
    this.contents = sections.map((section, index) => {
      const isCurrent = index + 1 === pageNumber

      return {
        title: section.title,
        href: href(index + 1),
        isCurrent,
        // On the page already, a heading's link need only scroll to it.
        subheadings: (section.subheadings ?? []).map(subheading => ({
          title: subheading.title,
          href: `${isCurrent ? '' : href(index + 1)}#${subheading.slug}`
        }))
      }
    })
    const bookmarkedTo = bookmarkedSections(cases ?? [], guide.id)
    // By the anchor the hub knows the section by, which is not always the
    // heading's anchor on the page (`slug`).
    const bookmarkOf = (anchor, slug) => anchor
      ? {
          href: `/guides/${encodeURIComponent(guide.id)}/bookmark?section=${encodeURIComponent(anchor)}`,
          bookmarkedTo: bookmarkedTo.get(anchor) ?? null,
          pin: pinnedSections && { guideId: guide.id, section: anchor, anchor: slug, returnTo, pinned: pinnedSections.get(anchor) ?? null }
        }
      : null

    // Every section is on the page, the others hidden until the browser's
    // find-in-page reaches into one. Each heading the hub gives a section ID
    // has its star, which pins its section, and its bookmark control; one in a
    // quote or a list has neither.
    this.pages = sections.map((section, index) => ({
      pageNumber: index + 1,
      section,
      bookmark: bookmarkOf(section.sectionAnchor, section.slug),
      headingBookmarks: section.headingSectionAnchors.map((anchor, at) => bookmarkOf(anchor, section.headingIds[at])),
      isCurrent: index + 1 === pageNumber,
      progressPercentage: Math.round((index + 1) / sections.length * 100),
      previous: adjacent(index),
      next: adjacent(index + 2)
    }))
    this.previous = adjacent(pageNumber - 1)
    this.next = adjacent(pageNumber + 1)
    this.metadataRows = metadataRows
    this.readingWidth = readingWidth
    this.readingWidths = READING_WIDTHS
    this.returnTo = returnTo
    this.pin = pin
    this.bookmarkAdded = bookmarked?.guideId === guide.id ? _bookmarkAdded(bookmarked, cases ?? []) : null
    this.panelCollapsed = panelCollapsed
  }

  /**
   * @param {string} guideId
   * @param {number} page
   * @returns {string}
   */
  static pageHref (guideId, page) {
    return `/guides/${encodeURIComponent(guideId)}?page=${page}`
  }
}

export {
  buildMetadataRows,
  GuideViewModel
}
