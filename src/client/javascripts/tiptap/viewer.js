/**
 * @module TipTap Viewer entry point
 */

import { Editor } from '@tiptap/core'

import { EXTENSIONS } from './extensions.js'

/**
 * Mounts a Tiptap editor on a container element reading JSON markdown content.
 *
 * @param {HTMLElement} element - Container element with embedded JSON content.
 * @returns {Editor | null} Initialised Editor instance, or null if absent.
 */
function mount (element) {
  const source = element.querySelector('script[type="application/json"]')
  if (!source) {
    return null
  }

  const markdown = JSON.parse(source.textContent)
  const target = document.createElement('div')
  element.replaceChildren(target)

  const editable = element.dataset.tiptapEditable === 'true'

  const editor = new Editor({
    element: target,
    extensions: EXTENSIONS,
    content: markdown,
    contentType: 'markdown',
    editable,
    // The page's CSP does not allow the stylesheet the editor would inject;
    // the rules it needs are in the page's own styles.
    injectCSS: false,
    // The editor marks itself a textbox, which hides a read-only guide's
    // headings and links from a screen reader's navigation.
    editorProps: editable ? {} : { attributes: { role: 'document' } }
  })

  keepLoadedImages(editor.view.dom)
  anchorHeadings(editor.view.dom, element.dataset.headingIds)

  return editor
}

/**
 * The editor's images are new elements, and a lazy one holds the space for
 * an image that has not loaded (see initGuideImages) until its `load` event
 * - which comes after the page has been laid out again, so an image the
 * fallback had already loaded would swell and then shrink. One the browser
 * already has (the fallback's, same address) is complete at once, so mark it.
 *
 * @param {HTMLElement} root - The editor's content
 */
function keepLoadedImages (root) {
  root.querySelectorAll('img').forEach((image) => {
    if (image.complete) {
      image.classList.add('is-loaded')
    }
  })
}

/**
 * Gives the editor's headings the ids the guide's links name them by, and
 * goes to the one the address names - the page was already at it, but
 * before there was anything there to go to.
 *
 * @param {HTMLElement} root - The editor's content
 * @param {string} [headingIds] - JSON list of the ids, in heading order
 */
function anchorHeadings (root, headingIds) {
  const ids = headingIds ? JSON.parse(headingIds) : []

  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
    if (ids[index]) {
      heading.id = ids[index]
    }
  })

  if (window.location.hash.length > 1) {
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView()
  }
}

document.querySelectorAll('[data-tiptap-markdown]').forEach(mount)

export { mount }
