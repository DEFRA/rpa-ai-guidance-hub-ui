/**
 * @module Where the API's search matches fall in a page's own rendering of a
 * guide, for the browser to paint them over the viewer's text.
 *
 * The API reads a guide a section at a time, from a heading to the next of
 * any level, and each section a block at a time (a heading, a paragraph, a
 * cell): a block's words with one space between them, a line between
 * blocks, no block without words. It answers each match as where it starts
 * and ends in that text, counted in characters, and the words it covers. A
 * page reads its own rendering the same way, character by character, each
 * with its place there, so that it finds each match at the API's positions.
 * A match whose words there are not the API's is not placed: it is never
 * marked on other words.
 */

/** What stands between two blocks' text, as the API keeps it. */
const LINE = '\n'

// Elements that start a new block: a phrase runs across bold or a link, but
// not from one of these into the next.
const BLOCK_TAGS = new Set([
  'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'dt', 'dd',
  'caption', 'figcaption', 'blockquote', 'pre', 'section', 'div', 'ul', 'ol',
  'table', 'tr'
])

// Text that is not the guide's own: code, words for screen readers only, and
// the headings' pin and bookmark controls.
const SKIPPED_TAGS = new Set(['script', 'style'])
const SKIPPED_CLASSES = new Set([
  'govuk-visually-hidden',
  'app-guide-section-bookmark',
  'app-guide-section-bookmarked',
  'app-guide-section-pin'
])

/**
 * @param {string} tag - An element's name, in any case
 * @returns {boolean} Whether the element starts a new block
 */
function isBlock (tag) {
  return BLOCK_TAGS.has(tag.toLowerCase())
}

/**
 * @param {string} tag - An element's name, in any case
 * @param {(name: string) => string|null} attribute - The element's
 *   attribute of that name, or null
 * @returns {boolean} Whether the element's text is not the guide's own
 */
function isSkipped (tag, attribute) {
  const classes = (attribute('class') ?? '').split(' ')

  return SKIPPED_TAGS.has(tag.toLowerCase()) ||
    attribute('aria-hidden') === 'true' ||
    classes.some(name => SKIPPED_CLASSES.has(name))
}

/**
 * A guide's text as its search reads it, section by section, each character
 * with its place in the page (whatever the reader uses to find it again).
 * Fed in reading order: `section` at each heading, `endBlock` at each
 * block's edge, `add` for each character of text.
 */
class SectionReader {
  #sections = new Map()
  #current = null
  #pending = ''
  #pendingPlace = null
  #blockHasWords = false

  /**
   * Read what follows into a section of its own.
   *
   * @param {string} anchor - Its heading's id on the page; empty for an
   *   Introduction
   */
  section (anchor) {
    this.#current = { characters: [], places: [] }
    this.#sections.set(anchor, this.#current)
    this.#pending = ''
    this.#blockHasWords = false
  }

  /** Read nothing until the next section: text the search does not read. */
  skip () {
    this.#current = null
  }

  /** A space within a block's words, of which a run is one. */
  #spaceAt (place) {
    if (this.#blockHasWords && this.#pending === '') {
      this.#pending = ' '
      this.#pendingPlace = place
    }
  }

  /** A block's edge: what follows is a block of its own. */
  endBlock () {
    if (this.#blockHasWords) {
      this.#pending = LINE
    }
    this.#blockHasWords = false
  }

  /**
   * @param {string} character - One; a run of spaces stands for one, placed
   *   at the first
   * @param {*} place - Where it is in the page; null for a space the page
   *   adds (a line break)
   */
  add (character, place) {
    if (!this.#current) {
      return
    }
    if (character.trim() === '') {
      this.#spaceAt(place)
      return
    }
    if (this.#pending) {
      this.#current.characters.push(this.#pending)
      this.#current.places.push(this.#pending === LINE ? null : this.#pendingPlace)
      this.#pending = ''
    }
    this.#current.characters.push(character)
    this.#current.places.push(place)
    this.#blockHasWords = true
  }

  /**
   * @param {string|null} anchor
   * @returns {boolean} Whether the page has that section
   */
  has (anchor) {
    return this.#sections.has(anchor)
  }

  /**
   * @param {string|null} anchor
   * @returns {string} The section's text, as the API keeps it
   */
  textOf (anchor) {
    return this.#sections.get(anchor)?.characters.join('') ?? ''
  }

  /**
   * @param {string|null} anchor - The section the API found the match in
   * @param {{start: number, end: number, text: string}} match - As the API
   *   answers it, counted in characters
   * @returns {Array<*>|null} The places of the characters it covers, but
   *   for the spaces between blocks and words that the page does not have;
   *   null when the page has other words there, or not that section
   */
  placesOf (anchor, { start, end, text }) {
    const section = this.#sections.get(anchor)

    if (section?.characters.slice(start, end).join('') !== text) {
      return null
    }

    return section.places.slice(start, end).filter(place => place !== null)
  }
}

export {
  isBlock,
  isSkipped,
  SectionReader
}
