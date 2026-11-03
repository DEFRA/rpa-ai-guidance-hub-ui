import { relativeHref } from '../common/relative-href.js'
import { versionTag } from '../common/version-tag.js'

const tableHeadClasses = {
  HALF_WIDTH: 'govuk-!-width-one-half',
  VISUALLY_HIDDEN: 'govuk-visually-hidden'
}

/**
 * Every `cell.type` a descriptor below can produce. `guidance-table.njk`'s
 * `_cell` macro must handle each one - it can't import this file, so if you
 * add or rename a type here, update that macro's branches too, otherwise
 * the new cell type will silently render nothing.
 */
const CELL_TYPES = Object.freeze({
  TEXT: 'text',
  VERSION: 'version',
  TITLE: 'title',
  REMOVE_ACTION: 'removeAction'
})

const DOCUMENT_TABLE_HEAD = [
  { text: 'Title', classes: tableHeadClasses.HALF_WIDTH },
  { text: 'Last modified' },
  { text: 'Version' },
  { text: 'Action' }
]

function _textCell (text) {
  return { type: CELL_TYPES.TEXT, text }
}

/**
 * A version greater than 1 is a re-publish rather than a first release, so
 * it's tagged purple instead of green - the colour is decided here, not in
 * the template, so every cell type follows the same rule as `_titleCell`:
 * the view model decides meaning, `guidance-table.njk` only renders it.
 *
 * @private
 */
function _versionCell (version) {
  const colour = Number.parseFloat(version) > 1 ? 'purple' : 'green'
  return { type: CELL_TYPES.VERSION, version, colour }
}

function _titleCell (item, statusText, statusColour) {
  return {
    type: CELL_TYPES.TITLE,
    text: item.title,
    href: relativeHref(item.href),
    statusText,
    statusColour
  }
}

function _removeActionCell (item) {
  return { type: CELL_TYPES.REMOVE_ACTION, text: item.title, href: relativeHref(item.removeHref) }
}

function _buildDocumentRows (items) {
  return items.map((item) => [
    _titleCell(item, item.status || 'Published', 'green'),
    _textCell(item.lastModified),
    _versionCell(item.version),
    _removeActionCell(item)
  ])
}

/**
 * One guide as the hub's rows show it: its version's tag, and its link made
 * safe.
 *
 * @private
 * @param {{title: string, href: string, versionNumber: string|null, purpose: string|null, lastUpdated: string, published: string}} item
 * @returns {{title: string, href: string, versionTag: {text: string, colour: string}|null, purpose: string|null, lastUpdated: string, published: string}}
 */
function _guideRow ({ versionNumber, ...item }) {
  return { ...item, href: relativeHref(item.href), versionTag: versionTag(versionNumber) }
}

/**
 * A list of guides shown as rows (`guide-list.njk`), not a table, headed by
 * how many guides it has and saying which of them it shows: all of them, on
 * one page.
 *
 * @private
 * @param {Object} list
 * @param {Array<object>} list.items
 * @param {string} list.emptyMessage
 */
function _buildGuideList ({ items, emptyMessage }) {
  const count = items.length

  return {
    heading: `${count} guide${count === 1 ? '' : 's'}`,
    showing: count > 0 ? `Showing 1 to ${count}` : null,
    emptyMessage,
    isGuideList: true,
    isEmpty: items.length === 0,
    count: items.length,
    guides: items.map(_guideRow)
  }
}

/**
 * @private
 * @param {Array<object>} items
 * @param {string} heading
 * @param {string} emptyMessage
 * @param {string|null} hintMessage
 * @param {Array<object>} head
 * @param {Array<Array<object>>} rows
 */
function _buildTable ({ items, heading, emptyMessage, hintMessage, head, rows }) {
  return {
    heading,
    emptyMessage,
    hintMessage,
    head,
    rows,
    isEmpty: items.length === 0,
    count: items.length
  }
}

/**
 * HubViewModel - The guidance tables shown on the hub landing page.
 *
 * Each table is built entirely from data (headings, empty-state copy,
 * column headers and cell content) rather than pre-rendered HTML, so
 * `guidance-table.njk` can render every table through one generic macro
 * and Nunjucks' auto-escaping is what's responsible for making the
 * output safe.
 */
class HubViewModel {
  /**
   * @param {Object} [data={}]
   * @param {Array<object>} [data.recentlyOpened=[]]
   * @param {Array<object>} [data.pinned=[]]
   * @param {Array<object>} [data.bookmarkedGuides=[]]
   * @param {Array<object>} [data.allGuides=[]] - Items are
   *   `{title, href, versionNumber, purpose, lastUpdated, published}`
   * @param {string} [data.shown='allGuides'] - The table that the page
   *   shows
   * @param {Object|null} [data.filters=null] - The filter panel beside the
   *   list (`filters.js`), if it has one
   * @param {string} [data.words=''] - Searched for, shown in the search box
   */
  constructor (data = {}) {
    const {
      recentlyOpened = [],
      pinned = [],
      bookmarkedGuides = [],
      allGuides = [],
      shown = 'allGuides',
      filters = null,
      words = ''
    } = data

    this.recentlyOpened = _buildTable({
      items: recentlyOpened,
      heading: 'Recently opened',
      emptyMessage: "You haven't opened any guidance yet. Any guidance you open will appear here.",
      hintMessage: `Your ${recentlyOpened.length} recently opened guidances`,
      head: DOCUMENT_TABLE_HEAD,
      rows: _buildDocumentRows(recentlyOpened)
    })

    this.pinned = _buildTable({
      items: pinned,
      heading: 'Pinned',
      emptyMessage: "You haven't pinned any guidance yet. Select 'Pin guide' on a guide to add it here.",
      hintMessage: "Guidance you've pinned for quick access.",
      head: DOCUMENT_TABLE_HEAD,
      rows: _buildDocumentRows(pinned)
    })

    this.bookmarkedGuides = _buildTable({
      items: bookmarkedGuides,
      heading: 'Bookmarked guides',
      emptyMessage: "You haven't bookmarked any guidance yet. Bookmark a section of a guide to add it here.",
      hintMessage: "Guidance you've bookmarked a section of.",
      head: DOCUMENT_TABLE_HEAD,
      rows: _buildDocumentRows(bookmarkedGuides)
    })

    this.allGuides = _buildGuideList({
      items: allGuides,
      emptyMessage: 'There are no guides yet.'
    })

    this.shown = this[shown]
    this.filters = filters
    this.words = words
  }
}

export {
  HubViewModel
}
