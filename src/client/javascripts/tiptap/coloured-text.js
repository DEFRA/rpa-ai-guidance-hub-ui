/**
 * @module Extensions for preserving coloured text in Markdown and
 * applying CSP-safe styling.
 */

import { Color, TextStyle } from '@tiptap/extension-text-style'

import {
  COLOURED_SPAN,
  colourClass,
  colourHex,
  colourModifier
} from './text-colours.js'

/**
 * Extension for serialising and deserialising bracketed coloured text spans.
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
        return undefined
      }

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
 * Extension applying a CSS class alongside inline colour styles for CSP
 * compliance.
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
