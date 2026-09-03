import { Editor } from '@tiptap/core'

import 'prosemirror-view/style/prosemirror.css'
import './styles.css'

import { countWords, diffLines } from './diff.js'
import { EXTENSIONS } from './extensions.js'
import { makeResizable } from './panes.js'
// Shared with the audit rather than kept here, so that what the audit measures and
// what this page shows cannot come apart. See `roundtrip.js`.
import { roundTrip } from './roundtrip.js'

const elements = {
  documentName: document.getElementById('document-name'),
  documentPath: document.getElementById('document-path'),
  editor: document.getElementById('editor'),
  error: document.getElementById('error'),
  losses: document.getElementById('losses'),
  source: document.getElementById('source'),
  statCharacters: document.getElementById('stat-characters'),
  statLines: document.getElementById('stat-lines'),
  stats: document.getElementById('stats'),
  statWords: document.getElementById('stat-words')
}

const toggleButtons = document.querySelectorAll('.toggle__button')

// The two Markdown documents the viewer can be pointed at: the file as the parser
// wrote it, and the same file after a trip through the editor. Rendering each in
// turn is how a loss that the diff shows as text becomes visible as a picture --
// colour, for instance, survives the first and not the second.
const documents = { original: '', roundTrip: '' }

let editor = null

/**
 * Show a failure in the page rather than only in the console, since the console
 * is not where anyone running this is looking.
 *
 * @param {string} message
 */
function fail (message) {
  elements.error.textContent = message
  elements.error.hidden = false
}

/**
 * Render Markdown into a read-only editor, replacing whatever was there.
 *
 * The instance is rebuilt rather than re-filled: swapping the content of a live
 * ProseMirror view would leave the old document's state behind, and there is
 * nothing here worth preserving across a switch.
 *
 * @param {string} markdown
 */
function render (markdown) {
  editor?.destroy()
  elements.editor.replaceChildren()

  editor = new Editor({
    element: elements.editor,
    extensions: EXTENSIONS,
    // @tiptap/markdown parses Markdown natively, so the document goes in as it is
    // with no conversion of our own in between.
    content: markdown,
    contentType: 'markdown',
    // A viewer, not an editor: the page is for reading the conversion, and nothing
    // here could save a change anyway.
    editable: false
  })

  // Reachable from the console, which is the quickest way to interrogate what the
  // schema made of a document (`editor.getJSON()`, `editor.getHTML()`).
  window.editor = editor
}

/**
 * Switch which of the two documents the viewer shows.
 *
 * @param {'original'|'roundTrip'} view
 */
function show (view) {
  render(documents[view])

  for (const button of toggleButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.view === view))
  }
}

/**
 * Render one side of the diff.
 *
 * Built as elements rather than an HTML string: the document is untrusted input
 * from a Word file, and there is no reason to hand it to an HTML parser.
 *
 * @param {HTMLElement} target
 * @param {Array<{ type: string, text: string }>} lines
 */
function renderDiff (target, lines) {
  const fragment = document.createDocumentFragment()

  for (const line of lines) {
    const element = document.createElement('span')
    element.className = line.type === 'same'
      ? 'line'
      : `line line--${line.type}`
    // A blank line still needs to occupy a row.
    element.textContent = line.text === '' ? ' ' : line.text
    fragment.append(element)
  }

  target.replaceChildren(fragment)
}

/**
 * Show a document as unchanged diff lines.
 *
 * The source pane is not a diff, but it sits directly above one, and reading down
 * the two only works if they share the diff's marker gutter. So it is built from
 * the same pieces rather than dropped in as plain text.
 *
 * @param {HTMLElement} target
 * @param {string} markdown
 */
function renderPlain (target, markdown) {
  renderDiff(
    target,
    markdown.split('\n').map((text) => ({ type: 'same', text }))
  )
}

/**
 * Format a before/after count with its delta.
 *
 * @param {HTMLElement} target
 * @param {number} before
 * @param {number} after
 */
function renderCount (target, before, after) {
  const difference = after - before
  const delta = document.createElement('span')

  delta.className = difference === 0 ? 'delta delta--none' : 'delta delta--loss'
  delta.textContent = difference === 0
    ? ' no change'
    : ` ${difference > 0 ? '+' : ''}${difference}`

  target.replaceChildren(`${before} → ${after}`, delta)
}

/**
 * Report what normalising the document through TipTap changed.
 *
 * @param {string} original
 * @param {string} normalised
 */
function reportLosses (original, normalised) {
  const lines = diffLines(original, normalised)

  renderDiff(elements.losses, lines)
  renderCount(elements.statWords, countWords(original), countWords(normalised))
  renderCount(elements.statCharacters, original.length, normalised.length)

  elements.statLines.textContent = String(
    lines.filter((line) => line.type !== 'same').length
  )
  elements.stats.hidden = false
}

async function main () {
  // Before the document is fetched, so that the panes can still be arranged when
  // the fetch is what failed and the page is showing an error.
  makeResizable()

  const response = await fetch('/document.json')

  if (!response.ok) {
    fail(`Could not read the document (HTTP ${response.status}).`)

    return
  }

  const { markdown, name, path } = await response.json()

  document.title = `${name} — Markdown preview`
  elements.documentName.textContent = name
  elements.documentPath.textContent = path
  renderPlain(elements.source, markdown)

  documents.original = markdown
  documents.roundTrip = roundTrip(markdown)

  reportLosses(documents.original, documents.roundTrip)

  for (const button of toggleButtons) {
    button.addEventListener('click', () => show(button.dataset.view))
  }

  show('original')
}

main().catch((error) => {
  fail(error.message)
  console.error(error)
})
