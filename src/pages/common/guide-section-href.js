/**
 * Where a link to a section of a guide goes: the guide at the section, which
 * the guide sends on to the page and heading that have it.
 *
 * @param {string} guideId
 * @param {string} anchor - The section's, as the hub knows it
 * @returns {string}
 */
function guideSectionHref (guideId, anchor) {
  return `/guides/${encodeURIComponent(guideId)}?section=${encodeURIComponent(anchor)}`
}

export {
  guideSectionHref
}
