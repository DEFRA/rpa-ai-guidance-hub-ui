/**
 * @module A search in a guide, counted: how many matches it holds, and how
 * many are under each contents entry. A match counts under the entry it comes
 * after, so one under a heading the contents do not list counts under the
 * entry before it.
 */

/**
 * @typedef {Object} Counted
 * @property {number} total - Every match
 * @property {Map<string, number>} byEntry - By the contents entry's
 *   `section`, as the view model's contents name it: how many matches under
 *   it
 * @property {Map<string, number>} firstOf - By the same: the number of the
 *   first match under it, counting from 1 in the guide's order
 */

/**
 * @private
 * @param {import('../../services/guide-sections.js').GuideSection[]} sections
 * @returns {Array<string>} The anchor the hub knows each heading by, in the
 *   guide's order: each section's own (an empty one for the Introduction,
 *   which has no heading), then those inside it; none for a heading it gives
 *   no anchor, such as an underlined one, whose words the search reads in the
 *   section before it
 */
function _anchorsInOrder (sections) {
  return sections.flatMap(section => [
    ...(section.slug === null ? [''] : [section.sectionAnchor]),
    ...section.headingSectionAnchors
  ].filter(anchor => anchor !== null))
}

/**
 * @param {import('../../services/guide-sections.js').GuideSection[]} sections
 * @param {Set<string>} entries - The contents entries, by `section`
 * @param {{sections: Array<{anchor: string|null, matches: Array<Object>}>}} found
 *   - The search's answer
 * @returns {Counted}
 */
function countMatches (sections, entries, found) {
  const inSection = new Map(found.sections.map(section => [section.anchor ?? '', section.matches.length]))
  const byEntry = new Map()
  const firstOf = new Map()
  let entry = null
  let before = 0

  for (const anchor of _anchorsInOrder(sections)) {
    entry = entries.has(anchor) ? anchor : entry
    const count = inSection.get(anchor) ?? 0

    if (entry !== null && count > 0) {
      byEntry.set(entry, (byEntry.get(entry) ?? 0) + count)
      firstOf.set(entry, firstOf.get(entry) ?? before + 1)
    }
    before += count
  }

  const total = [...inSection.values()].reduce((sum, count) => sum + count, 0)

  return { total, byEntry, firstOf }
}

export {
  countMatches
}
