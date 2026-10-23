import { Lexer } from 'marked'

const INTRODUCTION_TITLE = 'Introduction'

/**
 * A guide's Markdown is one document; the viewer reads it a section at a
 * time.
 *
 * @typedef {Object} GuideSection
 * @property {string} id - 'section-N', numbered from 1
 * @property {string} title - The section's heading, as plain text
 * @property {string|null} slug - The anchor the section's heading is linked
 *   by; null for an Introduction made of text before the first heading
 * @property {string[]} headingIds - The anchors of the headings inside
 *   `markdown`, in order
 * @property {Array<{title: string, slug: string}>} subheadings - The
 *   headings one level below the section's own
 * @property {string} markdown - Everything up to the next section, without
 *   the section's own heading
 */

/**
 * Split a guide's Markdown into sections at its shallowest heading level.
 *
 * A single leading `# Title` is the guide's title, shown by the page, so it
 * is dropped. Anything before the first section heading becomes an
 * "Introduction" section. Deeper headings stay inside their section's
 * Markdown.
 *
 * @param {string} markdown
 * @returns {GuideSection[]} Empty when the Markdown has no content
 */
function splitIntoSections (markdown) {
  const allTokens = new Lexer().lex(markdown ?? '')
  const slugs = _slugsOf(allTokens)
  const tokens = _withoutTitle(allTokens)
  const depth = _sectionDepth(tokens)

  if (depth === null) {
    return _build([_part(INTRODUCTION_TITLE, null, tokens.map(_raw))])
  }

  const parts = []

  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === depth) {
      parts.push(_part(_plainText(token), slugs.get(token), []))
    } else {
      if (parts.length === 0) {
        parts.push(_part(INTRODUCTION_TITLE, null, []))
      }

      _addToken(parts.at(-1), token, slugs, depth)
    }
  }

  return _build(parts)
}

/**
 * Add a token to the section it falls in, recording it if it is a heading.
 *
 * @private
 * @param {ReturnType<typeof _part>} part
 * @param {import('marked').Token} token
 * @param {Map<import('marked').Token, string>} slugs
 * @param {number} depth - The section heading depth
 */
function _addToken (part, token, slugs, depth) {
  part.raw.push(_raw(token))

  if (token.type !== 'heading') {
    return
  }

  const slug = slugs.get(token)

  part.headingIds.push(slug)

  if (token.depth === depth + 1) {
    part.subheadings.push({ title: _plainText(token), slug })
  }
}

/**
 * Point each link to a heading at the page that has the heading. The
 * guide's own links name a heading by its anchor, but the reader sees one
 * section at a time, so the heading may be on another page.
 *
 * Links to a heading on the same page, and links to anything that is not a
 * heading of the guide, are left as they are.
 *
 * @param {GuideSection[]} sections
 * @param {(page: number) => string} hrefForPage - The address of a page
 * @returns {GuideSection[]}
 */
function resolveAnchors (sections, hrefForPage) {
  const pageOf = new Map()

  sections.forEach((section, index) => {
    for (const slug of [section.slug, ...section.headingIds]) {
      if (slug) {
        pageOf.set(slug, index + 1)
      }
    }
  })

  return sections.map((section, index) => ({
    ...section,
    markdown: _rewrite(section.markdown, (token, start) => token.type === 'link'
      ? _linkEdit(token, start, slug => {
        const page = pageOf.get(slug)

        return page && page !== index + 1 ? `${hrefForPage(page)}#${slug}` : null
      })
      : null)
  }))
}

/**
 * Point each image at the address the browser can fetch it from. The
 * guide's content names an image relative to itself, which means nothing to
 * the page it is shown on.
 *
 * @param {GuideSection[]} sections
 * @param {(href: string) => string} hrefForImage - The address to use for an
 *   image's address; returning it unchanged leaves the image as it is
 * @returns {GuideSection[]}
 */
function resolveImages (sections, hrefForImage) {
  return sections.map(section => ({
    ...section,
    markdown: _rewrite(section.markdown, (token, start) => token.type === 'image'
      ? _imageEdit(token, start, hrefForImage)
      : null)
  }))
}

/**
 * Rewrite parts of the parsed Markdown. Code and escaped syntax are not
 * parsed as links or images, so they are never touched.
 *
 * @private
 * @param {string} markdown
 * @param {(token: import('marked').Token, start: number) => {start: number, end: number, text: string}|null} editFor
 *   - The edit to make for a token found at `start` in the source, or null
 *   to leave it as it is
 * @returns {string}
 */
function _rewrite (markdown, editFor) {
  const edits = []

  _collectEdits(new Lexer().lex(markdown), markdown, 0, editFor, edits)

  return edits.reduceRight(
    (result, { start, end, text }) => result.slice(0, start) + text + result.slice(end),
    markdown
  )
}

/**
 * @private
 * @param {import('marked').Token} token
 * @returns {import('marked').Token[]} The tokens nested directly in `token`,
 *   in source order
 */
function _children (token) {
  if (token.type === 'table') {
    return [...token.header, ...token.rows.flat()].flatMap(cell => cell.tokens)
  }

  return token.items ?? token.tokens ?? []
}

/**
 * Walk `tokens`, which appear in `source` in order from `from`, and record
 * the edit `editFor` gives for each, if any.
 *
 * @private
 * @param {import('marked').Token[]} tokens
 * @param {string} source
 * @param {number} from
 * @param {(token: import('marked').Token, start: number) => {start: number, end: number, text: string}|null} editFor
 * @param {Array<{start: number, end: number, text: string}>} edits
 */
function _collectEdits (tokens, source, from, editFor, edits) {
  let cursor = from

  for (const token of tokens) {
    const start = source.indexOf(token.raw, cursor)

    if (start === -1) {
      continue
    }

    const edit = editFor(token, start)

    if (edit) {
      edits.push(edit)
    }

    // A link's text can hold an image, so look inside it too.
    _collectEdits(_children(token), source, start, editFor, edits)

    cursor = start + token.raw.length
  }
}

/**
 * @private
 * @param {import('marked').Tokens.Link} link
 * @param {number} start - Where the link begins in the source
 * @param {(slug: string) => string|null} resolve
 * @returns {{start: number, end: number, text: string}|null} Null when the
 *   link is not an inline link to an anchor that needs rewriting
 */
function _linkEdit (link, start, resolve) {
  const opening = `[${link.text}](#`
  const slug = link.href.slice(1)
  const destination = link.href.startsWith('#') ? resolve(slug) : null

  if (!destination || !link.raw.startsWith(opening + slug)) {
    return null
  }

  const from = start + opening.length - 1

  return { start: from, end: from + 1 + slug.length, text: destination }
}

/**
 * @private
 * @param {import('marked').Tokens.Image} image
 * @param {number} start - Where the image begins in the source
 * @param {(href: string) => string} resolve
 * @returns {{start: number, end: number, text: string}|null} Null when the
 *   image is not an inline image whose address needs rewriting
 */
function _imageEdit (image, start, resolve) {
  const opening = `![${image.text}](`
  const destination = resolve(image.href)

  if (destination === image.href || !image.raw.startsWith(opening + image.href)) {
    return null
  }

  const from = start + opening.length

  return { start: from, end: from + image.href.length, text: destination }
}

/**
 * @private
 * @param {string} title
 * @param {string|null} slug
 * @param {string[]} raw
 * @returns {{title: string, slug: string|null, raw: string[], headingIds: string[], subheadings: Array<{title: string, slug: string}>}}
 */
function _part (title, slug, raw) {
  return { title, slug, raw, headingIds: [], subheadings: [] }
}

/**
 * @private
 * @param {Array<ReturnType<typeof _part>>} parts
 * @returns {GuideSection[]}
 */
function _build (parts) {
  return parts
    .map(({ title, slug, raw, headingIds, subheadings }) => ({
      title,
      slug,
      headingIds,
      subheadings,
      markdown: raw.join('').trim()
    }))
    .filter(part => part.markdown || part.slug !== null)
    .map((part, index) => ({ id: `section-${index + 1}`, ...part }))
}

/**
 * The anchor each heading is linked by: its text in lower case, without
 * punctuation, its spaces made hyphens, and a number added to repeats. This
 * is how the API writes the guide's links.
 *
 * @private
 * @param {import('marked').Token[]} tokens
 * @returns {Map<import('marked').Token, string>}
 */
function _slugsOf (tokens) {
  const slugs = new Map()
  const seen = new Map()

  for (const token of tokens.filter(({ type }) => type === 'heading')) {
    const base = _plainText(token)
      .toLowerCase()
      .replaceAll(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replaceAll(' ', '-')
    const count = seen.get(base) ?? 0

    seen.set(base, count + 1)
    slugs.set(token, count === 0 ? base : `${base}-${count}`)
  }

  return slugs
}

/**
 * @private
 * @param {import('marked').Token[]} tokens
 * @returns {import('marked').Token[]} `tokens` without a lone leading `# `
 *   title, if there is one
 */
function _withoutTitle (tokens) {
  const first = tokens.find(token => token.type !== 'space')
  const isTitle = first?.type === 'heading' &&
    first.depth === 1 &&
    tokens.filter(token => token.type === 'heading' && token.depth === 1).length === 1

  return isTitle ? tokens.filter(token => token !== first) : tokens
}

/**
 * @private
 * @param {import('marked').Token[]} tokens
 * @returns {number|null} The shallowest heading depth, or null if none
 */
function _sectionDepth (tokens) {
  const depths = tokens
    .filter(token => token.type === 'heading')
    .map(token => token.depth)

  return depths.length > 0 ? Math.min(...depths) : null
}

/**
 * @private
 * @param {import('marked').Token} token
 * @returns {string}
 */
function _raw (token) {
  return token.raw
}

/**
 * The text of a heading, without its Markdown formatting.
 *
 * @private
 * @param {{tokens?: import('marked').Token[], text?: string}} token
 * @returns {string}
 */
function _plainText (token) {
  if (!token.tokens) {
    return token.text ?? ''
  }

  return token.tokens.map(child => _plainText(child)).join('').trim()
}

export {
  resolveAnchors,
  resolveImages,
  splitIntoSections
}
