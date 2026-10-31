#!/usr/bin/env node
/**
 * @module Write a Markdown document out as the guide editor saves it.
 *
 * Loads the document into Tiptap with the guide viewer's own extensions and
 * asks for it back, so a conversion check can find what a load and save loses
 * or changes. Development use only: nothing in the application imports it.
 *
 * Usage:
 *   node scripts/round-trip-markdown.js <document.md> <saved.md>
 */
import fs from 'node:fs'

import { JSDOM } from 'jsdom'

// Without a DOM, Tiptap escapes the HTML in a document instead of reading it.
// Defined rather than assigned: `navigator` is getter-only on globalThis.
const { window } = new JSDOM('<!doctype html><html><body></body></html>')

for (const name of [
  'document',
  'DocumentFragment',
  'DOMParser',
  'Element',
  'getComputedStyle',
  'HTMLElement',
  'MutationObserver',
  'navigator',
  'Node',
  'Text'
]) {
  Object.defineProperty(globalThis, name, {
    value: window[name],
    configurable: true,
    writable: true
  })
}

Object.defineProperty(globalThis, 'window', {
  value: window,
  configurable: true,
  writable: true
})

// Imported after the DOM is in place, which static imports would not wait for.
const { Editor } = await import('@tiptap/core')
const { EXTENSIONS } = await import(
  '../src/client/javascripts/tiptap/extensions.js'
)

const [source, destination] = process.argv.slice(2)

if (!source || !destination) {
  console.error(
    'Usage: node scripts/round-trip-markdown.js <document.md> <saved.md>'
  )
  process.exitCode = 1
} else {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: EXTENSIONS,
    content: fs.readFileSync(source, 'utf8'),
    contentType: 'markdown',
    editable: false,
    injectCSS: false
  })

  fs.writeFileSync(destination, editor.getMarkdown(), 'utf8')
  editor.destroy()
}
