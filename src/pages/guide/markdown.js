import { Marked } from 'marked'

// The palette is the client viewer's own, so the fallback and the viewer
// colour the same spans the same way.
import { COLOURED_SPAN, colourClass } from '../../client/javascripts/tiptap/text-colours.js'
import { relativeHref } from '../common/relative-href.js'

const SAFE_ABSOLUTE_LINK = /^(https?:|mailto:)/i

// The JSON escape for `<`: a backslash, then 'u003c'.
const ESCAPED_LESS_THAN = String.raw`\u003c`

// The bare inline formatting tags the guides' source documents use. Only these
// exact tags, with no attributes, are passed through.
const FORMATTING_TAG = /(<\/?(?:u|b|strong|em|i|br)\s*\/?>)/gi

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

/**
 * @private
 * @param {string} text
 * @returns {string}
 */
function _escape (text) {
  return String(text).replaceAll(/[&<>"']/g, character => ESCAPES[character])
}

/**
 * Escapes HTML, but keeps the bare formatting tags (`<u>`, `<b>`, `<br>` and
 * the like) as the tags they are.
 *
 * @private
 * @param {string} html
 * @returns {string}
 */
function _escapeKeepingFormatting (html) {
  return String(html)
    .split(FORMATTING_TAG)
    .map((part, index) => index % 2 === 1 ? part.replaceAll(/\s+/g, '').toLowerCase() : _escape(part))
    .join('')
}

/**
 * A link or image address the page may emit: same-origin paths, in-page
 * anchors, and http(s) or mailto addresses. Anything else - `javascript:`,
 * `data:` and the like - is dropped.
 *
 * @private
 * @param {string} href
 * @returns {string|null}
 */
function _safeHref (href) {
  if (href.startsWith('#') || SAFE_ABSOLUTE_LINK.test(href)) {
    return href
  }

  return relativeHref(href, null)
}

/**
 * The renderers that keep guide Markdown, which comes from an uploaded
 * document and so is untrusted, from putting anything unsafe in the page:
 * raw HTML is escaped rather than passed through, and unsafe link and image
 * addresses are dropped.
 */
const SAFE_RENDERER = {
  html ({ text }) {
    return _escapeKeepingFormatting(text)
  },
  link ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens)
    const safe = _safeHref(href)

    if (safe === null) {
      return text
    }

    const titleAttribute = title ? ` title="${_escape(title)}"` : ''

    return `<a href="${_escape(safe)}"${titleAttribute}>${text}</a>`
  },
  image ({ href, title, text }) {
    const safe = _safeHref(href)

    if (safe === null) {
      return _escape(text)
    }

    const titleAttribute = title ? ` title="${_escape(title)}"` : ''

    return `<img src="${_escape(safe)}" alt="${_escape(text)}"${titleAttribute} loading="lazy">`
  }
}

/**
 * A bracketed coloured span, `[text]{.red}`, which the guides use to mark the
 * parts of a note to fill in. Only the colours in the palette are coloured, by
 * class, because the page's CSP does not allow inline styles; any other
 * modifier is left as the text it is.
 */
const COLOURED_SPAN_EXTENSION = {
  name: 'colouredSpan',
  level: 'inline',
  start: source => source.indexOf('['),
  tokenizer (source) {
    const match = COLOURED_SPAN.exec(source)
    const [raw, text, modifier] = match ?? []

    if (!colourClass(modifier)) {
      return undefined
    }

    return { type: 'colouredSpan', raw, modifier, tokens: this.lexer.inlineTokens(text) }
  },
  renderer (token) {
    return `<span class="${colourClass(token.modifier)}">${this.parser.parseInline(token.tokens)}</span>`
  }
}

/**
 * Renders guide Markdown to HTML for the server-side fallback, shown until
 * (or without) the client viewer.
 *
 * @param {string} markdown
 * @param {string[]} [headingIds] - The ids to give the headings, in order, so
 *   the guide's links to them work without the client viewer
 * @returns {string} HTML that is safe to output unescaped
 */
function renderMarkdownFallback (markdown, headingIds = []) {
  let headings = 0

  const renderer = new Marked({
    extensions: [COLOURED_SPAN_EXTENSION],
    renderer: {
      ...SAFE_RENDERER,
      heading ({ tokens, depth }) {
        const id = headingIds[headings]

        headings += 1
        const idAttribute = id ? ` id="${_escape(id)}"` : ''

        return `<h${depth}${idAttribute}>${this.parser.parseInline(tokens)}</h${depth}>\n`
      }
    }
  })

  return renderer.parse(markdown ?? '', { async: false })
}

/**
 * Serialise a value for a `<script type="application/json">` element. `<`
 * is escaped so the content can't close the element or open a comment.
 *
 * @param {unknown} value
 * @returns {string} JSON that is safe to output unescaped inside the script
 */
function jsonScript (value) {
  return JSON.stringify(value).replaceAll('<', ESCAPED_LESS_THAN)
}

export {
  jsonScript,
  renderMarkdownFallback
}
