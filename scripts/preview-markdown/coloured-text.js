/**
 * @fileoverview The two extensions that make a coloured run survive the round trip.
 *
 * Colour is not a mark of its own in Tiptap's schema: it is an attribute on
 * `textStyle`, and `@tiptap/extension-text-style` ships no Markdown spec at all. The
 * serialiser's response to a mark it has no handler for is an empty delimiter rather
 * than an error, so a coloured run is dropped in silence on the first save. That is
 * the shipped default, not a bug, and it means there is no upstream convention to
 * inherit -- the syntax in `text-colours.js` is one we define.
 *
 * Writing it as inline HTML was tried first and is worse than it looks. `marked`
 * hands inline HTML to Tiptap's `parseHTMLToken`, which runs it through an HTML
 * parse, so Markdown inside a `<span>` stops being Markdown: the page renders
 * correctly, the editor gets literal asterisks back, and the *next* save stores
 * them. A bracketed span avoids that because its contents are re-tokenised as
 * Markdown -- see `inlineTokens` below.
 */

import { Color, TextStyle } from '@tiptap/extension-text-style'

import {
  COLOURED_SPAN,
  colourClass,
  colourHex,
  colourModifier
} from './text-colours.js'

/**
 * The Markdown contract for a coloured run.
 *
 * It has to sit on `TextStyle` rather than on `Color`: the serialiser looks its
 * handlers up by mark name, and `Color` is an Extension contributing a global
 * attribute rather than a mark of its own.
 */
const MarkdownTextStyle = TextStyle.extend({
  markdownTokenizer: {
    name: 'textStyle',
    level: 'inline',
    start: (source) => source.indexOf('['),

    tokenize (source, _tokens, helpers) {
      const match = COLOURED_SPAN.exec(source)
      if (!match) {
        return undefined
      }

      const [raw, text, modifier] = match
      const colour = colourHex(modifier)
      if (!colour) {
        // Not one of ours. Declining leaves an ordinary link, and a class nobody
        // defined, as the literal text they are.
        return undefined
      }

      // Tokenising the span's own text is the line that keeps everything inside it
      // Markdown, so `[**bold**]{.red}` is still bold after a save and a reopen.
      return {
        type: 'textStyle',
        raw,
        text,
        colour,
        tokens: helpers.inlineTokens(text)
      }
    }
  },

  parseMarkdown: (token, helpers) =>
    helpers.applyMark('textStyle', helpers.parseInline(token.tokens ?? []), {
      color: token.colour
    }),

  renderMarkdown: (node, helpers) => {
    const content = helpers.renderChildren(node)
    const modifier = colourModifier(node.attrs?.color)
    return modifier ? `[${content}]{.${modifier}}` : content
  }
})

/**
 * The browser rendering: a class beside the library's inline style.
 *
 * The application sets `style-src 'self'` with no `'unsafe-inline'`, and
 * `style-src-attr` falls back to it, so the inline style the stock extension writes
 * does not apply in the real application at all. A nonce cannot rescue a style
 * attribute either. The style is left in place so that a colour outside the palette
 * still shows up somewhere it is not blocked; the class is what paints the page.
 */
const ClassColor = Color.extend({
  addGlobalAttributes () {
    const [group] = this.parent?.() ?? []

    return [
      {
        ...group,
        attributes: {
          ...group.attributes,
          color: {
            ...group.attributes.color,
            renderHTML: (attributes) => {
              const rendered = group.attributes.color.renderHTML(attributes)
              const modifier = colourModifier(attributes.color)
              const painted = modifier ? colourClass(modifier) : null
              return painted ? { ...rendered, class: painted } : rendered
            }
          }
        }
      }
    ]
  }
})

export { ClassColor, MarkdownTextStyle }
