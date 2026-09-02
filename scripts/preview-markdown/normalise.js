#!/usr/bin/env node
/**
 * Write out one converted document as the guidance editor would save it.
 *
 * The command-line face of `roundTrip`, and the third leg of the conversion audit:
 * the orchestrator converts a .docx to Markdown in the API repository, runs it
 * through here, and hands both back to the audit, which then scores what the editor
 * discarded as well as what the parser did.
 *
 * It runs the same editor the preview page runs, rather than a headless
 * approximation of it, because an audit that measures something other than what the
 * viewer shows is worse than no audit. That is what jsdom is here for, and the whole
 * of what it is for: Tiptap builds a real ProseMirror view, and a view needs a
 * document to attach to.
 *
 * Usage:
 *   node scripts/preview-markdown/normalise.js <document.md> <output.md>
 *
 * Normally reached through the orchestrator: `uv run task audit <doc.docx> --tiptap`.
 */
import fs from 'node:fs'

import { JSDOM } from 'jsdom'

// The globals Tiptap and ProseMirror reach for. Defined rather than assigned because
// some of them -- `navigator` -- are getter-only on globalThis in current node.
const dom = new JSDOM('<!doctype html><html><body></body></html>')

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
    value: dom.window[name],
    configurable: true,
    writable: true
  })
}

Object.defineProperty(globalThis, 'window', {
  value: dom.window,
  configurable: true,
  writable: true
})

// Imported only once the DOM is in place: `@tiptap/core` is not built to be loaded
// without one, and a static import would be hoisted above the setup above.
const { roundTrip } = await import('./roundtrip.js')

const [source, destination] = process.argv.slice(2)

if (!source || !destination) {
  console.error(
    'Usage: node scripts/preview-markdown/normalise.js <document.md> <output.md>'
  )
  process.exitCode = 1
} else {
  fs.writeFileSync(destination, roundTrip(fs.readFileSync(source, 'utf8')), 'utf8')
}
