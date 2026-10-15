const ASSET_PREFIX = '../assets/'

/**
 * The content names an image `../assets/<name>`; the browser can only reach
 * the guide's assets by the UI's route. For a renderer to call on each link
 * or image address as it parses it.
 *
 * @param {string} href
 * @param {string} guideId
 * @returns {string} The UI's asset route if `href` names an asset, else `href`
 */
function guideAssetHref (href, guideId) {
  if (!href.startsWith(ASSET_PREFIX)) {
    return href
  }

  const name = href.slice(ASSET_PREFIX.length)

  if (name === '' || name === '.' || name === '..') {
    return href
  }

  return `/guides/${encodeURIComponent(guideId)}/assets/${encodeURIComponent(name)}`
}

export { guideAssetHref }
