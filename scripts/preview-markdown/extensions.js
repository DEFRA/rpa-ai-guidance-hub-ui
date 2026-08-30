import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'

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
  Table,
  TableRow,
  TableCell,
  TableHeader,
  Markdown,
  // Colour has no Markdown syntax, so it only ever arrives as inline HTML from the
  // converted Word document. Included so that those runs still show up coloured.
  // The real editor will need a variant of Color that renders a class as well,
  // because the application's `style-src 'self'` would strip the inline style
  // attribute; there is no CSP in front of this page, so the stock one is enough.
  TextStyle,
  Color,
  Highlight
]

export { EXTENSIONS }
