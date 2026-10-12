/**
 * @module Table extension preserving multi-block cells and lists across
 * Markdown round-trips.
 */

import { Table, renderTableToMarkdown } from '@tiptap/extension-table'

const MARKER = '- '

/**
 * Splits a paragraph's inline content on hard breaks.
 *
 * @param {object[]} content - Array of inline content nodes.
 * @returns {object[][]} Content grouped by line.
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
 * Checks whether a line starts with an unstyled bullet marker.
 *
 * @param {object[]} line - Array of inline nodes representing a line.
 * @returns {boolean} True if the line starts with a bullet marker.
 */
function isItem (line) {
  const [first] = line

  return (
    first?.type === 'text' &&
    !first.marks?.length &&
    first.text.startsWith(MARKER)
  )
}

/**
 * Converts a bulleted line into a list item node.
 *
 * @param {object[]} line - Array of inline nodes representing a bulleted line.
 * @returns {object} A listItem node.
 */
function item (line) {
  const [first, ...rest] = line
  const text = first.text.slice(MARKER.length)
  const content = text ? [{ ...first, text }, ...rest] : rest

  return { type: 'listItem', content: [{ type: 'paragraph', content }] }
}

/**
 * Reconstructs a paragraph node from lines separated by hard breaks.
 *
 * @param {object[][]} kept - Groups of inline nodes to join.
 * @returns {object} A paragraph node.
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
 * Promotes trailing bulleted lines within a cell paragraph into a bullet list.
 *
 * @param {object} cell - The table cell or header node.
 * @returns {object} The cell node with bullet lines converted to a list.
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
 * Recursively promotes bulleted lines into lists for all cells in a node tree.
 *
 * @param {object} node - The AST node to traverse.
 * @returns {object} The updated node tree.
 */
function promoteCells (node) {
  if (node.type === 'tableCell' || node.type === 'tableHeader') {
    return promote(node)
  }

  return node.content
    ? { ...node, content: node.content.map(promoteCells) }
    : node
}

/**
 * Adapts markdown helpers so multi-block cell nodes render via their own
 * handlers.
 *
 * @param {object} helpers - Serialiser helpers.
 * @returns {object} Updated helpers with block-level renderChildren.
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

/**
 * Table extension extending stock Table with trimmed output and cell list
 * support.
 */
const FaithfulTable = Table.extend({
  parseMarkdown: (token, helpers) =>
    promoteCells(Table.config.parseMarkdown(token, helpers)),
  renderMarkdown: (node, helpers) =>
    renderTableToMarkdown(node, perBlock(helpers)).trim()
})

export { FaithfulTable }
