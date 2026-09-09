/**
 * @fileoverview Naming the sections of a document, the same way in every pane.
 *
 * The panes hold the same document in three forms -- Markdown, a diff of it, and a
 * rendering of it -- and nothing about a position in one of them says where the same
 * place is in another. Headings are the one landmark all three keep, so they are what
 * the panes are locked to; this is the part that has to agree about which heading is
 * which, working from `## **Section 1**` in two of them and from `Section 1` in the
 * third.
 *
 * A name is therefore reduced to the letters and digits it has in common with the
 * other panes' version of it, and numbered by how many times it has been seen, so
 * that a document repeating "Overview" still has one anchor per section.
 */

// A trailing run of hashes is Word's closing fence, not part of the heading.
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const FENCE = /^ {0,3}(```|~~~)/

/**
 * Reduce a heading to what every pane's copy of it still has in common.
 *
 * @param {string} text as written, in Markdown or as rendered
 * @returns {string}
 */
function name (text) {
  return text
    // A colour span or an `<u>` run leaves its tags in the Markdown and nothing in
    // the rendering; a link leaves its target in the Markdown and nothing in the
    // rendering. Both have to go before the two can be compared.
    .replace(/<[^>]*>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Number headings as they are met, so repeated names stay distinguishable.
 *
 * @returns {(text: string) => string}
 */
function keys () {
  const seen = new Map()

  return (text) => {
    const label = name(text)
    const occurrence = (seen.get(label) ?? 0) + 1

    seen.set(label, occurrence)

    return `${label}#${occurrence}`
  }
}

/**
 * Key the heading lines of a Markdown document, one entry per line.
 *
 * Added lines are passed over rather than keyed: they are the round trip's own copy
 * of a line that is already in the document above them, and counting both would put
 * the diff pane's second "Overview" against the source pane's first.
 *
 * @param {Array<{ type: string, text: string }>} lines
 * @returns {Array<string|null>} the section each line opens, aligned with `lines`
 */
function markdownSections (lines) {
  const key = keys()
  let fenced = false

  return lines.map((line) => {
    if (line.type === 'added') {
      return null
    }

    if (FENCE.test(line.text)) {
      fenced = !fenced

      return null
    }

    const heading = fenced ? null : HEADING.exec(line.text)

    return heading ? key(heading[2]) : null
  })
}

/**
 * Key the headings of a rendered document, in place.
 *
 * The editor is read-only and rebuilt from scratch on every switch, so an attribute
 * put on its DOM stays where it was put.
 *
 * @param {HTMLElement} root
 */
function markEditorSections (root) {
  const key = keys()

  for (const heading of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    heading.dataset.section = key(heading.textContent)
  }
}

export { markdownSections, markEditorSections }
