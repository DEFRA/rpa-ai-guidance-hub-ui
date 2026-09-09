import { Editor } from '@tiptap/core'

import { EXTENSIONS } from './extensions.js'

/**
 * Put the given Markdown through the editor and ask for it back.
 *
 * The one definition of what "the editor" does to a document, shared by the preview
 * page and the conversion audit. A second implementation of this would be a second
 * opinion about precisely the thing they both exist to measure, and the two would
 * drift: an earlier attempt to answer the question without an editor -- parsing to
 * Tiptap JSON and serialising it back -- agreed with this one about `<u>` and
 * disagreed about `<br>`, reporting every line break in a table as a loss that a
 * real save does not incur.
 *
 * Done in a detached instance so a visible viewer is never briefly showing a
 * document nobody asked for. That needs a DOM, which a page has and node does not;
 * `normalise.js` supplies one before importing this.
 *
 * @param {string} markdown
 * @returns {string} the same document, as the editor would save it
 */
function roundTrip (markdown) {
  const scratch = new Editor({
    element: document.createElement('div'),
    extensions: EXTENSIONS,
    content: markdown,
    contentType: 'markdown',
    editable: false
  })

  const serialised = scratch.getMarkdown()
  scratch.destroy()

  return serialised
}

export { roundTrip }
