/**
 * @module Headings as a guide's page draws them in the viewer: each with its
 * controls after it - its star and its bookmark - and, once bookmarked, the
 * cases under it, as the server-rendered fallback has them, so the page does
 * not change when the viewer takes over.
 */

import { Heading } from '@tiptap/extension-heading'

import { bookmarkedToHtml, headingControlsHtml } from '../../../constants/heading-bookmarks.js'

/**
 * @param {import('@tiptap/pm/model').Node} doc
 * @param {number} position - A heading's
 * @returns {number} How many headings come before it, at any depth: its index
 *   among the page's headings, which their bookmarks are given in
 */
function headingsBefore (doc, position) {
  let count = 0

  doc.descendants((node, at) => {
    if (node.type.name === 'heading' && at < position) {
      count += 1
    }

    return at < position
  })

  return count
}

const BookmarkedHeading = Heading.extend({
  addOptions () {
    return { ...this.parent?.(), bookmarks: [] }
  },

  addNodeView () {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      const row = document.createElement('div')
      const heading = document.createElement(`h${node.attrs.level}`)
      const bookmark = this.options.bookmarks[headingsBefore(editor.state.doc, getPos())]

      dom.className = 'app-guide-heading'
      row.className = 'app-guide-heading-row app-guide-heading-row--sub'
      row.append(heading)
      dom.append(row)

      if (bookmark) {
        row.insertAdjacentHTML('beforeend', headingControlsHtml(bookmark, node.textContent))
        dom.insertAdjacentHTML('beforeend', bookmarkedToHtml(bookmark))
      }

      // The control and the words under the heading are the page's, not the
      // guide's: only a change to the heading's own text is the editor's.
      const ignoreMutation = mutation => mutation.type !== 'selection' &&
        (mutation.type === 'attributes' || !heading.contains(mutation.target))

      return { dom, contentDOM: heading, ignoreMutation }
    }
  }
})

/**
 * The viewer's extensions, its headings drawn with their bookmarks.
 *
 * @param {Array<object>} extensions
 * @param {Array<import('../../../constants/heading-bookmarks.js').HeadingBookmark>} bookmarks
 *   - Each heading's, in order
 * @returns {Array<object>} `extensions` itself when there are none
 */
function extensionsWithBookmarks (extensions, bookmarks) {
  if (bookmarks.length === 0) {
    return extensions
  }

  return extensions.map(extension => extension.name === 'heading' ? BookmarkedHeading.configure({ bookmarks }) : extension)
}

export {
  extensionsWithBookmarks,
  headingsBefore
}
