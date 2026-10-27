import { formatIsoDate } from '../common/format-date.js'
import { READING_WIDTHS } from './reading-width.js'

const UNTITLED = 'Untitled guide'
const VERSION_COLOURS = ['green', 'purple', 'blue', 'orange', 'pink', 'turquoise']

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
    _listRow('Scheme', metadata.schemes),
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
 * @param {number} number - The version's number
 * @returns {{text: string, colour: string}}
 */
function _versionTag (number) {
  return {
    text: `Version ${number}`,
    colour: VERSION_COLOURS[(number - 1) % VERSION_COLOURS.length]
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
   */
  constructor ({ guide, sections, pageNumber, readingWidth, returnTo, metadataRows, panelCollapsed = false }) {
    const href = page => GuideViewModel.pageHref(guide.id, page)
    const adjacent = (page) => {
      const section = sections[page - 1]

      return section ? { href: href(page), labelText: section.title } : null
    }

    this.guideId = guide.id
    this.title = guide.title ?? UNTITLED
    this.version = _versionTag(guide.versions.length)
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
    // Every section is on the page, the others hidden until the browser's
    // find-in-page reaches into one.
    this.pages = sections.map((section, index) => ({
      pageNumber: index + 1,
      section,
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
