/**
 * @fileoverview The table extension, corrected so that a cell means the same thing
 * on the way out as it did on the way in.
 *
 * Three corrections, all of them about the fact that a GFM pipe row is a single
 * line and a cell is not. The stock extension writes a cell's blocks joined by
 * `<br>`, which is the only thing the format allows -- and then reads that `<br>`
 * back as nothing but a line break, so structure survives the write and is lost on
 * the next read.
 *
 * 1. `renderMarkdown` trims the table's own blank lines. `renderTableToMarkdown`
 *    opens with `let out = "\n"` and ends every row with a newline, so a serialised
 *    table carries a blank line at each end. The serialiser then puts its own blank
 *    line between top-level blocks on top of those, and the total depends on what a
 *    table sits next to: beside a paragraph the stray is absorbed into the one
 *    separator a paragraph needs; between two tables both strays stack and the gap
 *    becomes three blank lines. Read back, three blank lines are one blank line
 *    *plus* an empty paragraph -- which serialises to two more on the next save, and
 *    two more after that, so a document holding two adjacent tables grows every time
 *    it is saved. Trimming makes a table render like every other block and leaves
 *    the separator to do the separating.
 *
 * 2. `renderChildren` is given each block of a multi-block cell, and unwraps a node
 *    to its own children rather than running the node's handler -- joining them with
 *    the empty string. A cell holding a paragraph and a list therefore comes back as
 *    `Do this:<br>- one- two`: the items welded together, the line breaks between
 *    them gone. It is silent, because a damaged cell is a single paragraph again on
 *    the next read and so the *second* save matches the first. Idempotent and wrong.
 *
 * 3. `parseMarkdown` promotes a cell whose text is a list back into a list. This is
 *    the read that (2) makes safe, and the pair is what closes the loop: the stock
 *    serialiser already writes a cell-level list as `- one<br>- two`, so reading
 *    that form back as a list makes the cell a fixed point -- the same Markdown, but
 *    a real list in the editor rather than a paragraph wearing hyphens. Nothing in
 *    the document changes; what changes is that whoever edits the cell gets list
 *    behaviour, and the converter needs no special case for it.
 *
 * All three are upstream behaviour rather than anything the converter does: the
 * Markdown a converted document arrives as has the single blank line CommonMark asks
 * for, and writes its cell lists in exactly the form (3) reads.
 */

import { Table, renderTableToMarkdown } from '@tiptap/extension-table'

const MARKER = '- '

/**
 * Split a paragraph's inline content on its hard breaks.
 *
 * @param {object[]} content
 * @returns {object[][]} one group per line, in order
 */
function lines (content) {
  const split = [[]]

  for (const child of content) {
    if (child.type === 'hardBreak') {
      split.push([])
    } else {
      split[split.length - 1].push(child)
    }
  }

  return split
}

/**
 * Whether a line opens with a bullet marker that is text rather than emphasis.
 *
 * A marked-up marker -- `**- one**` -- is not something the converter writes for a
 * list, so it is left as the text it is.
 *
 * @param {object[]} line
 * @returns {boolean}
 */
function isItem (line) {
  const [first] = line

  return (
    first?.type === 'text' && !first.marks?.length && first.text.startsWith(MARKER)
  )
}

/**
 * One bulleted line as a list item, with the marker taken off its text.
 *
 * @param {object[]} line
 * @returns {object} a `listItem` node
 */
function item (line) {
  const [first, ...rest] = line
  const text = first.text.slice(MARKER.length)
  // `- [a link](...)` leaves nothing behind, and an empty text node is not a node.
  const content = text ? [{ ...first, text }, ...rest] : rest

  return { type: 'listItem', content: [{ type: 'paragraph', content }] }
}

/**
 * Rejoin lines that stay a paragraph, restoring the breaks between them.
 *
 * @param {object[][]} kept
 * @returns {object} a `paragraph` node
 */
function paragraph (kept) {
  return {
    type: 'paragraph',
    content: kept.flatMap((line, index) =>
      index ? [{ type: 'hardBreak' }, ...line] : line
    )
  }
}

/**
 * A cell with any trailing run of bulleted lines turned into a list.
 *
 * Deliberately all-or-nothing from the first bullet on: a cell that goes back to
 * prose after a bullet is not a list with a stray paragraph in it, it is prose that
 * happens to contain a hyphen, so it is left alone.
 *
 * @param {object} cell
 * @returns {object} the cell, promoted if it qualifies
 */
function promote (cell) {
  if (cell.content?.length !== 1 || cell.content[0].type !== 'paragraph') {
    return cell
  }

  const split = lines(cell.content[0].content ?? [])
  const first = split.findIndex(isItem)

  if (first < 0 || !split.slice(first).every(isItem)) {
    return cell
  }

  const list = { type: 'bulletList', content: split.slice(first).map(item) }
  const lead = split.slice(0, first)

  return { ...cell, content: lead.length ? [paragraph(lead), list] : [list] }
}

/**
 * @param {object} node
 * @returns {object} the same tree, with every cell in it promoted
 */
function promoteCells (node) {
  if (node.type === 'tableCell' || node.type === 'tableHeader') {
    return promote(node)
  }

  return node.content ? { ...node, content: node.content.map(promoteCells) } : node
}

/**
 * The render helpers, with `renderChildren` made to render a node it is handed
 * rather than the node's children.
 *
 * The table renderer passes each block of a multi-block cell to `renderChildren`,
 * which is built for a fragment: given a node it drops to `node.content` and joins
 * with the empty string, so a list arrives as its items with nothing between them.
 * `renderChild` is the one that runs the node's own handler. The index it takes
 * places a node among its siblings for handlers that look backwards, and a cell's
 * blocks are not siblings of anything the table renderer names -- the parent it
 * supplies is the table -- so there is no meaningful index to pass.
 *
 * @param {object} helpers
 * @returns {object} the same helpers, fixed
 */
function perBlock (helpers) {
  return {
    ...helpers,
    renderChildren: (nodes, separator) =>
      Array.isArray(nodes)
        ? helpers.renderChildren(nodes, separator)
        : helpers.renderChild(nodes, 0)
  }
}

const FaithfulTable = Table.extend({
  // Wrapped rather than reimplemented: the stock parse is thirty lines of header,
  // alignment and row handling that this has no opinion about, and only the shape of
  // a finished cell to change.
  parseMarkdown: (token, helpers) =>
    promoteCells(Table.config.parseMarkdown(token, helpers)),
  renderMarkdown: (node, helpers) =>
    renderTableToMarkdown(node, perBlock(helpers)).trim()
})

export { FaithfulTable }
