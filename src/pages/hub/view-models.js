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

const EDITING_TABLE_HEAD = [
  { text: 'Document name', classes: tableHeadClasses.HALF_WIDTH },
  { text: 'Version' },
  { text: 'Last modified' },
  { text: 'Action', classes: tableHeadClasses.VISUALLY_HIDDEN }
]

const AWAITING_APPROVAL_TABLE_HEAD = [
  { text: 'Document name', classes: tableHeadClasses.HALF_WIDTH },
  { text: 'Version' },
  { text: 'Publishing checks' },
  { text: 'Changes requested' }
]

/**
 * A table cell built from trusted, pre-escaped data only - never a pre-built
 * HTML string - so the govuk-frontend table macro can render it without an
 * `html` cell risking unescaped user content (e.g. a guidance title).
 *
 * `type` tells `guidance-table.njk` how to render the cell: `text` cells go
 * straight into govukTable's `text` option (auto-escaped by Nunjucks);
 * every other type is markup the template builds itself from these
 * (also auto-escaped) fields.
 *
 * @private
 */

/**
 * An arbitrary base for resolving `href` with the `URL` constructor - never
 * itself navigated to, just a fixed origin to compare `href`'s resolved
 * origin against.
 *
 * @private
 */
const SAME_ORIGIN_BASE = 'http://same-origin.invalid'

/**
 * Nunjucks auto-escaping only entity-encodes `href` values - it doesn't
 * stop a `javascript:`/`data:` scheme from executing on click. Guidance
 * items will eventually come from an API rather than this repo's own
 * code, so hrefs are treated as untrusted and restricted to same-origin
 * relative paths.
 *
 * A leading-slash regex isn't enough here: browsers normalise backslashes
 * in special URLs, so `/\evil.example` is navigated to as protocol-relative
 * (`//evil.example`) despite "looking" like a single-slash path. Resolving
 * `href` against `SAME_ORIGIN_BASE` with the `URL` constructor applies that
 * same normalisation, so comparing the resolved origin catches it.
 *
 * @private
 * @param {string} href
 * @returns {string} `href`, or "#" when it isn't a safe relative path
 */
function _relativeHref (href) {
  if (typeof href !== 'string' || !href.startsWith('/')) {
    return '#'
  }

  try {
    return new URL(href, SAME_ORIGIN_BASE).origin === SAME_ORIGIN_BASE ? href : '#'
  } catch {
    return '#'
  }
}

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
    href: _relativeHref(item.href),
    statusText,
    statusColour
  }
}

function _removeActionCell (item) {
  return { type: CELL_TYPES.REMOVE_ACTION, text: item.title, href: _relativeHref(item.removeHref) }
}

function _buildDocumentRows (items) {
  return items.map((item) => [
    _titleCell(item, item.status || 'Published', 'green'),
    _textCell(item.lastModified),
    _versionCell(item.version),
    _removeActionCell(item)
  ])
}

function _buildEditingRows (items) {
  return items.map((item) => [
    _titleCell(item, 'Draft', 'grey'),
    _versionCell(item.version),
    _textCell(item.lastModified),
    _removeActionCell(item)
  ])
}

function _buildAwaitingApprovalRows (items) {
  return items.map((item) => [
    _titleCell(item, 'Awaiting approval', 'yellow'),
    _versionCell(item.version),
    _textCell(item.publishingChecks || 'No issues'),
    _textCell(item.changesRequested || 'None')
  ])
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
 * HubViewModel - The four guidance tables shown on the hub landing page.
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
   * @param {Array<object>} [data.savedGuidance=[]]
   * @param {Array<object>} [data.editing=[]]
   * @param {Array<object>} [data.awaitingApproval=[]]
   */
  constructor (data = {}) {
    const {
      recentlyOpened = [],
      savedGuidance = [],
      editing = [],
      awaitingApproval = []
    } = data

    this.recentlyOpened = _buildTable({
      items: recentlyOpened,
      heading: 'Recently opened',
      emptyMessage: "You haven't opened any guidance yet. Any guidance you open will appear here.",
      hintMessage: `Your ${recentlyOpened.length} recently opened guidances`,
      head: DOCUMENT_TABLE_HEAD,
      rows: _buildDocumentRows(recentlyOpened)
    })

    this.savedGuidance = _buildTable({
      items: savedGuidance,
      heading: 'Saved guidance',
      emptyMessage: "You haven't saved any guidance yet. Select 'Save' on a guide to add it here.",
      hintMessage: "Guidance you've saved for quick access.",
      head: DOCUMENT_TABLE_HEAD,
      rows: _buildDocumentRows(savedGuidance)
    })

    this.editing = _buildTable({
      items: editing,
      heading: 'Editing',
      emptyMessage: 'You are not currently editing any guidance documents.',
      hintMessage: null,
      head: EDITING_TABLE_HEAD,
      rows: _buildEditingRows(editing)
    })

    this.awaitingApproval = _buildTable({
      items: awaitingApproval,
      heading: 'Awaiting approval',
      emptyMessage: 'There are no guidance documents awaiting approval.',
      hintMessage: null,
      head: AWAITING_APPROVAL_TABLE_HEAD,
      rows: _buildAwaitingApprovalRows(awaitingApproval)
    })
  }
}

export {
  HubViewModel
}
