/**
 * Where a link to a section of a guide goes. It names the section twice: as
 * `section`, which the guide shows the page that has it for, in the stepper;
 * and as the fragment, which the browser goes to in either format. The guide
 * never sends such a link on, so the browser keeps the fragment.
 *
 * @param {string} guideId
 * @param {string} anchor - The section's, as the hub knows it
 * @param {Object} [options]
 * @param {string} [options.slug] - Its heading's anchor on the page, when
 *   known, if that is not the hub's: a repeated heading can be numbered
 *   differently
 * @param {string} [options.words] - Words searched for, kept as `q` for the
 *   guide to search them again
 * @returns {string}
 */
function guideSectionHref (guideId, anchor, { slug = anchor, words } = {}) {
  const searched = words ? `&q=${encodeURIComponent(words)}` : ''

  return `/guides/${encodeURIComponent(guideId)}?section=${encodeURIComponent(anchor)}${searched}#${encodeURIComponent(slug)}`
}

export {
  guideSectionHref
}
