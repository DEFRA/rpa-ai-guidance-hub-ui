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

import { NEW_TAB_TEXT, opensInNewTab } from '../../../constants/new-tab-links.js'
import { ClassColor, MarkdownTextStyle } from './coloured-text.js'
import { FaithfulTable } from './tables.js'

/**
 * The link mark: one out of the hub opens in a new tab and says so, as the
 * server-drawn guide's do. The words are drawn with the link, since the
 * viewer owns its DOM; the link's text goes in a span of its own, because
 * ProseMirror's content hole must be the only child of its element.
 */
const GuideLink = Link.extend({
  renderHTML (props) {
    const [tag, attributes, content] = this.parent(props)

    if (!opensInNewTab(attributes.href)) {
      return [tag, attributes, content]
    }

    return [
      tag,
      { ...attributes, target: '_blank', rel: 'noopener noreferrer' },
      ['span', content],
      ['span', { class: 'govuk-visually-hidden' }, NEW_TAB_TEXT]
    ]
  }
})

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
  // Tiptap opens every link in a new tab by default. A guide's links within
  // the hub should stay in the tab, so leave those to the browser, as the
  // plain anchors they are; GuideLink opens the rest in a new tab.
  GuideLink.configure({ openOnClick: false, HTMLAttributes: { target: null } }),
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
