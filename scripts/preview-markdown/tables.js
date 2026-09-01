/**
 * @fileoverview The table extension, with its Markdown trimmed so a round trip is
 * idempotent.
 *
 * `renderTableToMarkdown` opens with `let out = "\n"` and ends every row with a
 * newline, so a serialised table carries a blank line at each end. The serialiser
 * then puts its own blank line between top-level blocks on top of those, and the
 * total depends on what a table sits next to:
 *
 * - beside a paragraph, the stray line is absorbed into the one separator a
 *   paragraph needs, and the document is stable from the first save;
 * - between two tables, both strays stack on the separator and the gap becomes three
 *   blank lines. Reading that back, three blank lines are one blank line *plus* an
 *   empty paragraph -- which serialises to two more on the next save, and two more
 *   after that.
 *
 * So a document holding two adjacent tables grows every time it is saved. Trimming
 * the edges makes a table render like every other block and leaves the separator to
 * do the separating, which is what stops the growth at its source rather than
 * normalising it away afterwards.
 *
 * This is upstream behaviour rather than anything the converter does -- the Markdown
 * a converted document arrives as has the single blank line CommonMark asks for.
 */

import { Table, renderTableToMarkdown } from '@tiptap/extension-table'

const IdempotentTable = Table.extend({
  renderMarkdown: (node, helpers) => renderTableToMarkdown(node, helpers).trim()
})

export { IdempotentTable }
