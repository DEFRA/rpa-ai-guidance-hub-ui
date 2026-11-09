import { relativeHref } from '../common/relative-href.js'
import { versionTag } from '../common/version-tag.js'
import { searchPagination } from './search.js'

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
 * @param {{id: string, pin: {pinned: boolean, position: number|null}|null, title: string, href: string, versionNumber: string|null, purpose: string|null, lastUpdated: string, published: string}} item
 *   - `pin` is null when the user's pins are not known, and the row offers none
 * @returns {{id: string, pin: {pinned: boolean, position: number|null}|null, title: string, href: string, versionTag: {text: string, colour: string}|null, purpose: string|null, lastUpdated: string, published: string}}
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
 * @param {string} [list.noun='guide'] - What the heading counts
 * @param {string} list.emptyMessage
 */
function _buildGuideList ({ items, noun = 'guide', emptyMessage }) {
  const count = items.length

  return {
    heading: `${count} ${noun}${count === 1 ? '' : 's'}`,
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
 * @private
 * @param {number} count
 * @param {string} one - The noun for one
 * @param {string} many - The noun for any other count
 * @returns {string}
 */
function _counted (count, one, many) {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * @private
 * @param {import('../../services/search.js').SearchResult} result
 * @returns {Object} As `search-results.njk` shows it: its link made safe, and
 *   its guide and how often it matches as one line
 */
function _searchRow (result) {
  return {
    title: result.title,
    href: relativeHref(result.href),
    hint: `${result.documentTitle} · ${_counted(result.matches, 'match', 'matches')}`,
    snippet: result.snippet
  }
}

/**
 * @private
 * @param {Object} search
 * @param {string} search.words
 * @param {number} search.page
 * @param {import('../../services/search.js').SearchResults} search.found
 * @returns {string|null} Why there are no results to list, if there are none
 */
function _searchEmptyMessage (search) {
  if (search.found.tooManyMatches) {
    return 'Too many matches. Use more specific words.'
  }

  if (search.found.total === 0) {
    return `No guides have the words “${search.words}”. Check the spelling or try fewer words.`
  }

  if (search.found.results.length === 0) {
    return `There is no page ${search.page} of results.`
  }

  return null
}

/**
 * The results of searching the guides, as `search-results.njk` shows them.
 *
 * @private
 * @param {Object} search
 * @param {string} search.words
 * @param {number} search.page
 * @param {import('../../services/search.js').SearchResults} search.found
 * @returns {Object}
 */
function _buildSearch (search) {
  const found = search.found

  return {
    words: search.words,
    heading: _counted(found.total, 'result', 'results'),
    emptyMessage: _searchEmptyMessage(search),
    results: found.tooManyMatches ? [] : found.results.map(_searchRow),
    pagination: searchPagination({ words: search.words, page: search.page, total: found.total, tooManyMatches: found.tooManyMatches })
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
   * @param {Array<object>} [data.recentlyOpened=[]] - Items are as for
   *   `allGuides`
   * @param {Array<object>} [data.pinned=[]] - Items are as for `allGuides`
   * @param {Array<object>} [data.bookmarkedGuides=[]]
   * @param {Array<object>} [data.allGuides=[]] - Items are
   *   `{id, pin, title, href, versionNumber, purpose, lastUpdated, published}`
   * @param {string} [data.shown='allGuides'] - The table that the page
   *   shows
   * @param {Object|null} [data.filters=null] - The filter panel beside the
   *   list (`filters.js`), if it has one
   * @param {boolean} [data.nothingToFilter=false] - The list has no guides for
   *   the chosen filters to narrow, so they don't explain why it is empty
   * @param {string} [data.words=''] - Searched for, shown in the search box
   * @param {{words: string, page: number, found: import('../../services/search.js').SearchResults}|null} [data.search=null]
   *   - What searching for the words found, shown instead of the list
   * @param {boolean} [data.searchUnavailable=false] - Searching failed, so the
   *   list is shown with a warning instead
   */
  constructor (data = {}) {
    const {
      recentlyOpened = [],
      pinned = [],
      bookmarkedGuides = [],
      allGuides = [],
      shown = 'allGuides',
      filters = null,
      nothingToFilter = false,
      words = '',
      search = null,
      searchUnavailable = false
    } = data

    // Chosen filters that leave nothing say so, rather than that there are no
    // guides at all, unless they had nothing to narrow.
    const nothingMatches = filters?.selected?.length > 0 && !nothingToFilter
      ? 'No guides match your search or filters. Try removing some filters or using different search terms.'
      : null

    this.recentlyOpened = _buildGuideList({
      items: recentlyOpened,
      noun: 'recently opened guide',
      emptyMessage: nothingMatches ?? "You haven't opened any guidance yet. Any guidance you open will appear here."
    })

    this.pinned = _buildGuideList({
      items: pinned,
      noun: 'pinned guide',
      emptyMessage: nothingMatches ?? "You haven't pinned any guidance yet. Select 'Pin guide' on a guide to add it here."
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
      emptyMessage: nothingMatches ?? 'There are no guides yet.'
    })

    this.shown = this[shown]
    this.filters = filters
    this.words = words
    this.search = search && _buildSearch(search)
    this.searchUnavailable = searchUnavailable
  }
}

export {
  HubViewModel
}
