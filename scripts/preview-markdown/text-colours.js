/**
 * @fileoverview The colour palette the guidance editor carries, and the Markdown
 * syntax that carries it.
 *
 * Markdown has no syntax for colour, so a coloured run is written as a Pandoc-style
 * bracketed span -- `[text]{.red}`. Only the modifier in the braces is ever stored:
 * the editor maps it to a hex to colour the mark, and a renderer maps it to a class
 * to colour the page, so neither a hex nor a class name is baked into a document and
 * the palette can be restyled without rewriting content.
 *
 * This file is the single definition of both. The syntax has to be implemented once
 * for the editor and once for whatever renders a published page, and two regexes
 * drifting apart is the obvious failure mode, so neither end owns it.
 */

// The parser matches every colour a Word document carries to one of these, so the
// list is the whole vocabulary a converted document can use.
const TEXT_COLOURS = [
  { modifier: 'red', hex: '#d4351c', name: 'Red text' },
  { modifier: 'blue', hex: '#1d70b8', name: 'Blue text' }
]

/**
 * One coloured span, anchored: a tokenizer is handed the rest of the source and
 * must only claim a span starting exactly where it is looking.
 *
 * The inner text allows an escaped character, which a naive `[^\]]+` does not. That
 * matters more than it sounds: a converted document escapes the brackets an author
 * typed, so `[SBI]` in red arrives as `[\[SBI\]]{.red}`, and a class stopping at the
 * first `]` would decline the span and drop the colour on every placeholder written
 * that way. Escaping is not the problem -- an unescaped `[[SBI]]{.red}` fails the
 * same way -- so the alternation is what has to be here.
 *
 * A link inside a coloured run is still out of scope: its `](` would need balanced
 * matching rather than one more alternative. Nothing produces one, because Word
 * paints its own colour on every hyperlink and the parser drops it.
 */
const COLOURED_SPAN = /^\[((?:\\.|[^\]\\])+)\]\{\.([a-z]+)\}/

const CLASS_PREFIX = 'markdown-preview__text--'

const HEX_BY_MODIFIER = new Map(
  TEXT_COLOURS.map(({ hex, modifier }) => [modifier, hex])
)

const MODIFIER_BY_HEX = new Map(
  TEXT_COLOURS.map(({ hex, modifier }) => [hex, modifier])
)

/**
 * The modifier naming a colour, or null if it is not one of ours.
 *
 * @param {string} hex
 * @returns {string|null}
 */
function colourModifier (hex) {
  return MODIFIER_BY_HEX.get(hex) ?? null
}

/**
 * The colour a modifier names, or null if it is not one of ours.
 *
 * Returning null is what lets a tokenizer decline a span it does not recognise,
 * which is what leaves an ordinary `[link](/x)` -- and a `{.mauve}` nobody defined --
 * as the literal text they are.
 *
 * @param {string} modifier
 * @returns {string|null}
 */
function colourHex (modifier) {
  return HEX_BY_MODIFIER.get(modifier) ?? null
}

/**
 * The CSS class painting a modifier, or null if it is not one of ours.
 *
 * @param {string} modifier
 * @returns {string|null}
 */
function colourClass (modifier) {
  return HEX_BY_MODIFIER.has(modifier) ? `${CLASS_PREFIX}${modifier}` : null
}

export { COLOURED_SPAN, TEXT_COLOURS, colourClass, colourHex, colourModifier }
