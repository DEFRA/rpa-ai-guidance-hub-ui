/**
 * @module Configured Tiptap extensions for rendering guidance Markdown.
 */

import { Blockquote } from '@tiptap/extension-blockquote'
import { Bold } from '@tiptap/extension-bold'
import { Code } from '@tiptap/extension-code'
import { CodeBlock } from '@tiptap/extension-code-block'
import { Document } from '@tiptap/extension-document'
import { HardBreak } from '@tiptap/extension-hard-break'
import { Heading } from '@tiptap/extension-heading'
import { Highlight } from '@tiptap/extension-highlight'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { Image } from '@tiptap/extension-image'
import { Italic } from '@tiptap/extension-italic'
import { Link } from '@tiptap/extension-link'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Strike } from '@tiptap/extension-strike'
import { TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Text } from '@tiptap/extension-text'
import { Underline } from '@tiptap/extension-underline'
import { Markdown } from '@tiptap/markdown'

import { ClassColor, MarkdownTextStyle } from './coloured-text.js'
import { FaithfulTable } from './tables.js'

/**
 * Configured Tiptap extensions defining the guidance document schema.
 *
 * These are StarterKit's schema extensions, listed individually so the
 * bundle leaves out its editing-only ones (undo/redo, drop and gap cursors,
 * list keymaps, trailing node). The editor adds those itself.
 *
 * @type {Array<object>}
 */
const EXTENSIONS = [
  Document,
  Paragraph,
  Text,
  Heading,
  Blockquote,
  BulletList,
  OrderedList,
  ListItem,
  CodeBlock,
  HorizontalRule,
  HardBreak,
  Bold,
  Italic,
  Strike,
  Underline,
  Code,
  // The editor opens a link in a new tab by default. A guide's links to
  // its own sections should stay in the page, so leave the link to the
  // browser, as the plain anchor it is.
  Link.configure({ openOnClick: false, HTMLAttributes: { target: null } }),
  Image.configure({ HTMLAttributes: { loading: 'lazy', decoding: 'async' } }),
  FaithfulTable,
  TableRow,
  TableCell,
  TableHeader,
  Markdown,
  MarkdownTextStyle,
  ClassColor,
  Highlight
]

export { EXTENSIONS }
