import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'

import { ClassColor, MarkdownTextStyle } from './coloured-text.js'
import { IdempotentTable } from './tables.js'

// The extension list is the schema, and the schema decides what the preview can
// show: anything it cannot model is dropped as the document is read in. So a
// construct missing from the page is as likely to be absent from this list as it
// is to be missing from the parser's Markdown -- check here first.
//
// It is deliberately the set the guidance editor is expected to ship with, so what
// the preview shows is what a designer would really see. When that editor lands in
// `src/`, this list is what it should be built from, which is why it sits in its
// own file rather than inline in the page.

// Underline is off because the editor this list seeds must not turn it on: the
// serialiser emits `++text++`, which is not Markdown, so a reader's renderer would
// show the plus signs literally. The visible consequence here is that `<u>` runs in
// a converted document render as plain text.
const EXTENSIONS = [
  StarterKit.configure({ underline: false }),
  Image,
  // The stock Table pads its Markdown with a blank line at each end, which two
  // adjacent tables turn into a document that grows on every save. See `tables.js`.
  IdempotentTable,
  TableRow,
  TableCell,
  TableHeader,
  Markdown,
  // Colour has no Markdown syntax of its own, so it is carried as a bracketed span
  // -- `[text]{.red}` -- which these two halves define between them: the mark owns
  // the Markdown, and the Color variant owns what the browser paints. Both are the
  // real thing rather than a preview stand-in, because the stock pair loses a
  // coloured run on the first save and could not render it under the application's
  // CSP anyway. See `coloured-text.js`.
  MarkdownTextStyle,
  ClassColor,
  Highlight
]

export { EXTENSIONS }
