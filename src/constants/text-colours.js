/**
 * @module Palette definitions and Markdown bracketed span syntax for
 * coloured text.
 */

/**
 * Supported text colours mapping modifiers to hex codes and display names.
 *
 * @type {Array<{modifier: string, hex: string, name: string}>}
 */
const TEXT_COLOURS = [
  { modifier: 'red', hex: '#d4351c', name: 'Red text' },
  { modifier: 'blue', hex: '#1d70b8', name: 'Blue text' }
]

/**
 * Regular expression matching a bracketed colour span, supporting escaped
 * characters (e.g. `[text]{.red}`).
 *
 * @type {RegExp}
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
 * Gets the modifier name for a given hex colour code.
 *
 * @param {string} hex - Hex colour code.
 * @returns {string | null} Modifier name, or null if unknown.
 */
function colourModifier (hex) {
  return MODIFIER_BY_HEX.get(hex) ?? null
}

/**
 * Gets the hex colour code for a given modifier name.
 *
 * @param {string} modifier - Colour modifier name.
 * @returns {string | null} Hex colour code, or null if unknown.
 */
function colourHex (modifier) {
  return HEX_BY_MODIFIER.get(modifier) ?? null
}

/**
 * Gets the CSS class name for a given colour modifier.
 *
 * @param {string} modifier - Colour modifier name.
 * @returns {string | null} CSS class name, or null if unknown.
 */
function colourClass (modifier) {
  return HEX_BY_MODIFIER.has(modifier) ? `${CLASS_PREFIX}${modifier}` : null
}

export { COLOURED_SPAN, TEXT_COLOURS, colourClass, colourHex, colourModifier }
