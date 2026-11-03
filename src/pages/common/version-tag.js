// The latest version is the live one, so its tag says so in one colour,
// whatever its number. A superseded version will need a colour of its own.
const LIVE_VERSION_COLOUR = 'green'

/**
 * A version's tag, wherever the hub shows one: its number as its author
 * gave it, in the live version's colour.
 *
 * @param {string|null|undefined} versionNumber - `major.minor`
 * @returns {{text: string, colour: string}|null} Null for a version made
 *   before versions had numbers, or none
 */
function versionTag (versionNumber) {
  if (!versionNumber) {
    return null
  }

  return { text: `Version ${versionNumber}`, colour: LIVE_VERSION_COLOUR }
}

export { versionTag }
