/**
 * @module Search in a guide, in the browser: the matches the API found are
 * painted in the guide's text, one of them current; Previous and Next, and
 * Enter and Shift+Enter in the search box (with the same words), step between
 * them, showing the page that holds one in the stepper, and a contents
 * entry's count goes to the first match under it; Ctrl+F (Cmd+F) comes
 * to the search box, and a second press is the browser's own find.
 *
 * The server hands over the matches in order, each by the id its section's
 * heading has on the page (empty for an Introduction), and the ids of the headings that start a section as the
 * search reads the guide. The viewer replaces the server's HTML, so the
 * matches are placed in the page as it is (search-places.js) and painted
 * with the CSS Custom Highlight API, which leaves the viewer's text alone. A
 * match whose words in the page are not the search's is not painted. Where
 * the browser cannot paint highlights, the page shows the counts only.
 */

import { isBlock, isSkipped, SectionReader } from '../../constants/search-places.js'

const MATCHES = 'guide-keyword-match'
const CURRENT = 'guide-keyword-current'
const HEADINGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

// Room between a match brought into view and the window's edges.
const MARGIN = 16

// A page of the guide: in the stepper, all but one are hidden.
const PAGE = '[data-guide-page]'

// The search box, where the words are typed.
const WORDS_INPUT = 'input[name="q"]'

// A contents entry's count, which goes to the first match under it.
const FIRST_UNDER = '[data-guide-search-first]'
const STEPS_CLASS = 'app-guide-contents__count--steps'

// The parts of a guide a search reads: each page's title and its text.
const READ = '[data-guide-page] .app-guide-heading-1, [data-guide-page] .app-guide-markdown'

/**
 * @param {number} current - The current match's number, from 1
 * @param {number} total
 * @param {boolean} back
 * @returns {number} The match before or after, round at either end
 */
function steppedMatch (current, total, back) {
  return back ? (current - 2 + total) % total + 1 : current % total + 1
}

/**
 * @param {{key: string, ctrlKey: boolean, metaKey: boolean, altKey: boolean}} event
 * @returns {boolean} Whether it is Ctrl+F, or Cmd+F on a Mac
 */
function isFindShortcut (event) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f'
}

/**
 * @param {string} platform - `navigator.platform`
 * @returns {string} The find shortcut as the reader's keyboard has it
 */
function shortcutLabel (platform) {
  return ['Mac', 'iPhone', 'iPad'].some(name => platform.includes(name)) ? '⌘ F' : 'Ctrl F'
}

/**
 * @param {string} typed - In the search box
 * @param {string} searched - The words the page was searched for
 * @returns {boolean} Whether they are the same words, whatever their case
 *   or spacing, so Enter steps rather than searching again
 */
function sameWords (typed, searched) {
  const words = text => text.toLowerCase().split(/\s+/).filter(Boolean).join(' ')

  return words(typed) === words(searched)
}

/**
 * @private
 * @param {Node} node
 * @param {Element} root
 * @returns {Element|null} The block the node is in, within the root
 */
function _blockOf (node, root) {
  let element = node.parentElement

  while (element && element !== root && !isBlock(element.tagName)) {
    element = element.parentElement
  }

  return element
}

/**
 * @private
 * Start reading one of the parts a search reads: a page's title starts its
 * page's section (or, as a made-up title, nothing); an Introduction's text
 * starts its section, which has no heading; any other page's text reads on.
 *
 * @param {Element} root
 * @param {SectionReader} reader
 * @param {Set<string>} starts - The ids of the headings that start a section
 */
function _startPart (root, reader, starts) {
  reader.endBlock()
  if (root.matches('.app-guide-heading-1')) {
    if (starts.has(root.id)) {
      reader.section(root.id)
    } else {
      reader.skip()
    }
  } else if (root.closest(PAGE)?.dataset.guidePageSection === '') {
    reader.section('')
  } else {
    // A page's text reads on in its title's section.
  }
}

/**
 * @private
 * @param {Element} root - A part of the guide a search reads
 * @param {SectionReader} reader - Reading it into its sections, each
 *   character placed by its text node, offset and length
 * @param {Set<string>} starts
 */
function _readPart (root, reader, starts) {
  const walker = root.ownerDocument.createTreeWalker(root, window.NodeFilter.SHOW_ELEMENT | window.NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.nodeType === window.Node.ELEMENT_NODE && isSkipped(node.tagName, name => node.getAttribute(name))
      ? window.NodeFilter.FILTER_REJECT
      : window.NodeFilter.FILTER_ACCEPT
  })
  let lastBlock = null

  while (walker.nextNode()) {
    const node = walker.currentNode

    if (node.nodeType === window.Node.ELEMENT_NODE) {
      if (HEADINGS.has(node.tagName) && starts.has(node.id)) {
        reader.section(node.id)
      }
      if (node.tagName === 'BR') {
        reader.add(' ', null)
      }
      continue
    }

    const block = _blockOf(node, root)
    let offset = 0

    if (block !== lastBlock) {
      reader.endBlock()
    }
    for (const character of node.data) {
      reader.add(character, { node, offset, length: character.length })
      offset += character.length
    }
    lastBlock = block
  }
}

/**
 * @private
 * A contents entry's count, made a button that goes to the first match under
 * it: without the script, it is the count alone.
 *
 * @param {HTMLElement} count
 */
function _asButton (count) {
  const button = document.createElement('button')

  button.type = 'button'
  button.className = `${count.className} ${STEPS_CLASS}`
  button.dataset.guideSearchFirst = count.dataset.guideSearchFirst
  button.append(...count.childNodes)
  button.setAttribute('aria-label', `${button.textContent}: go to the first`)
  count.replaceWith(button)
}

/**
 * Where each match is in the page as it is now.
 *
 * @param {Array<{anchor: string|null, start: number, end: number, text: string}>} found
 *   - Every match the search found, in order, as the server hands them over
 * @param {Set<string>} starts - The ids of the headings that start a section
 * @param {Document} [doc]
 * @returns {Array<Range|null>} Each match's place; null for one whose words
 *   there are not the search's
 */
function placeMatches (found, starts, doc = document) {
  const reader = new SectionReader()

  for (const root of doc.querySelectorAll(READ)) {
    _startPart(root, reader, starts)
    _readPart(root, reader, starts)
  }

  return found.map((match) => {
    const places = reader.placesOf(match.anchor, match)

    if (!places?.length) {
      window.console.warn('Did not paint a search match: the page has other words there', match)

      return null
    }

    const range = doc.createRange()
    const last = places.at(-1)

    range.setStart(places[0].node, places[0].offset)
    range.setEnd(last.node, last.offset + last.length)

    return range
  })
}

/**
 * The page's search once it has matches: see the module's description.
 *
 * @private
 */
class GuideSearch {
  constructor (form) {
    this.form = form
    this.input = form.querySelector(WORDS_INPUT)
    this.position = form.querySelector('[data-guide-search-position]')
    this.words = form.dataset.guideSearchQ
    this.found = JSON.parse(form.dataset.guideSearchMatches)
    this.starts = new Set(JSON.parse(form.dataset.guideSearchSections))
    this.current = 1
    this.matches = []
    this.moved = false
    this.movedOn = () => { this.moved = true }
  }

  start () {
    this.form.querySelector('[data-guide-search-controls]')?.removeAttribute('hidden')
    this.matches = placeMatches(this.found, this.starts)
    // As every later match is shown: its page too, in the stepper.
    this.show(this._firstShown())
    this._listen()
    this._watch()
  }

  /** The first match on a page that is shown, else the first. */
  _firstShown () {
    const shown = this.matches.findIndex(range => range && !range.startContainer.parentElement.closest(`${PAGE}[hidden]`))

    return shown === -1 ? 1 : shown + 1
  }

  /** Place the matches again, once the page's text has changed under them. */
  _refind () {
    this.matches = placeMatches(this.found, this.starts)
    this.current = Math.min(this.current, this.matches.length)
    this._paint()
    this._bringIntoView()
  }

  _paint () {
    window.CSS.highlights.set(MATCHES, new window.Highlight(...this.matches.filter(Boolean)))
    window.CSS.highlights.set(CURRENT, new window.Highlight(...this.matches.slice(this.current - 1, this.current).filter(Boolean)))
    if (this.position) {
      this.position.textContent = `Match ${this.current} of ${this.matches.length}`
    }
  }

  _bringIntoView () {
    const range = this.matches[this.current - 1]
    const box = range?.getBoundingClientRect()

    if (!box || (box.top >= MARGIN && box.bottom <= window.innerHeight - MARGIN)) {
      return
    }
    window.scrollBy(0, (box.top + box.bottom) / 2 - window.innerHeight / 2)
  }

  show (number) {
    this.current = number
    const page = this.matches[number - 1]?.startContainer.parentElement.closest(PAGE)

    if (page?.hasAttribute('hidden')) {
      page.dispatchEvent(new window.CustomEvent('guide-pages:show'))
    }
    this._paint()
    this._bringIntoView()
    this._followUntilMoved()
  }

  /**
   * Lazy images change the page's height as they load: keep the current
   * match in view until the reader moves on.
   */
  _followUntilMoved () {
    this.moved = false
    for (const type of ['wheel', 'touchstart', 'mousedown', 'keydown']) {
      window.addEventListener(type, this.movedOn, { once: true, capture: true })
    }
  }

  _step (back) {
    if (this.matches.length) {
      this.show(steppedMatch(this.current, this.matches.length, back))
    }
  }

  _listen () {
    this.form.addEventListener('click', (event) => {
      const step = event.target.closest('[data-guide-search-step]')

      if (step) {
        this._step(step.dataset.guideSearchStep === 'previous')
      }
    })
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && sameWords(this.input.value, this.words)) {
        event.preventDefault()
        this._step(event.shiftKey)
      }
    })
    // A contents entry's count goes to the first match under it, and gives
    // the focus back to the search box, where Enter goes on to the next.
    document.querySelectorAll(FIRST_UNDER).forEach(_asButton)
    document.getElementById('guide:contents')?.addEventListener('click', (event) => {
      const count = event.target.closest(FIRST_UNDER)

      if (count) {
        this.show(Number(count.dataset.guideSearchFirst))
        this.input.focus({ preventScroll: true })
      }
    })
  }

  _watch () {
    let refinding = false
    const observer = new window.MutationObserver(() => {
      if (refinding) {
        return
      }
      refinding = true
      window.requestAnimationFrame(() => {
        refinding = false
        this._refind()
      })
    })

    document.querySelectorAll(PAGE).forEach(page =>
      observer.observe(page, { childList: true, subtree: true, characterData: true })
    )

    this._followUntilMoved()
    new window.ResizeObserver(() => {
      if (!this.moved) {
        this._bringIntoView()
      }
    }).observe(document.body)
  }
}

/**
 * @private
 * Ctrl+F (Cmd+F) comes to the search box and selects its words, its shortcut
 * shown in it; pressed again, with the words still selected, it is the
 * browser's own find.
 *
 * @param {HTMLFormElement} form
 */
function _bringFindHere (form) {
  const input = form.querySelector(WORDS_INPUT)
  const kbd = document.createElement('kbd')

  input.setAttribute('aria-keyshortcuts', 'Control+F Meta+F')
  kbd.className = 'app-search-kbd'
  kbd.setAttribute('aria-hidden', 'true')
  kbd.textContent = shortcutLabel(navigator.platform)
  kbd.hidden = Boolean(input.value)
  input.after(kbd)
  input.addEventListener('input', () => { kbd.hidden = Boolean(input.value) })

  document.addEventListener('keydown', (event) => {
    if (isFindShortcut(event) && !_isSelected(input)) {
      event.preventDefault()
      input.focus()
      input.select()
    }
  })
}

/**
 * @private
 * @param {HTMLInputElement} input
 * @returns {boolean} Whether it has the focus with all its words selected, as
 *   Ctrl+F leaves it
 */
function _isSelected (input) {
  return document.activeElement === input && input.selectionStart === 0 && input.selectionEnd === input.value.length
}

/**
 * Keep the focus in the search box of a page loaded with a search, so Enter
 * there steps through the matches: a new search loads the page again. The
 * focus is put back once the page has loaded, since the viewer redrawing the
 * guide can take it.
 *
 * @param {{focus: Function}} input - The search box
 * @param {Window} [win]
 */
function holdFocus (input, win = window) {
  const focus = () => input.focus({ preventScroll: true })

  focus()
  if (win.document.readyState !== 'complete') {
    win.addEventListener('load', () => win.setTimeout(focus, 0), { once: true })
  }
}

/**
 * Search in a guide, on the guide's page: see the module's description.
 *
 * @returns {void}
 */
function initGuideSearch () {
  const form = document.querySelector('[data-guide-search]')

  if (!form) {
    return
  }

  _bringFindHere(form)

  const input = form.querySelector(WORDS_INPUT)

  if (input.value.trim()) {
    holdFocus(input)
  }

  if (form.dataset.guideSearchMatches && window.CSS?.highlights) {
    new GuideSearch(form).start()
  }
}

export {
  holdFocus,
  initGuideSearch,
  isFindShortcut,
  placeMatches,
  sameWords,
  shortcutLabel,
  steppedMatch
}
