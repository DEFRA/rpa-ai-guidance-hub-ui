/**
 * @module A search in a guide, counted: how many matches it holds, and how
 * many are under each contents entry. A match counts under the entry it comes
 * after, so one under a heading the contents do not list counts under the
 * entry before it; one in the guide's title counts under none.
 */

/**
 * @typedef {Object} Counted
 * @property {number} total - Every match, the title's too
 * @property {Map<string, number>} byEntry - By the contents entry's
 *   `section`, as the view model's contents name it: how many matches under
 *   it
 */

/**
 * @private
 * @param {import('../../services/guide-sections.js').GuideSection[]} sections
 * @returns {Array<string>} The anchor the hub knows each heading by, in the
 *   guide's order: each section's own (an empty one for an introduction),
 *   then those inside it; none for a heading it gives no anchor
 */
function _anchorsInOrder (sections) {
  return sections.flatMap(section => [
    section.sectionAnchor ?? '',
    ...section.headingSectionAnchors.filter(anchor => anchor !== null)
  ])
}

/**
 * @param {import('../../services/guide-sections.js').GuideSection[]} sections
 * @param {Set<string>} entries - The contents entries, by `section`
 * @param {{title: Array<Object>, sections: Array<{anchor: string|null, matches: Array<Object>}>}} found
 *   - The search's answer
 * @returns {Counted}
 */
function countMatches (sections, entries, found) {
  const inSection = new Map(found.sections.map(section => [section.anchor ?? '', section.matches.length]))
  const byEntry = new Map()
  let entry = null

  for (const anchor of _anchorsInOrder(sections)) {
    entry = entries.has(anchor) ? anchor : entry
    const count = inSection.get(anchor) ?? 0

    if (entry !== null && count > 0) {
      byEntry.set(entry, (byEntry.get(entry) ?? 0) + count)
    }
  }

  const inSections = [...inSection.values()].reduce((sum, count) => sum + count, 0)

  return { total: found.title.length + inSections, byEntry }
}

export {
  countMatches
}
