/**
 * Placeholder origin that relative hrefs are resolved against - `.invalid`
 * is reserved, so it can never collide with a real host.
 */
const SAME_ORIGIN_BASE = 'https://same-origin.invalid'

// Where a form goes back to when it does not say, or names another site.
const FALLBACK_RETURN_URL = '/hub'

/**
 * Nunjucks auto-escaping only entity-encodes `href` values - it doesn't
 * stop a `javascript:`/`data:` scheme from executing on click. Hrefs that
 * come from an API or a query string are therefore treated as untrusted and
 * restricted to same-origin relative paths.
 *
 * A leading `/` alone isn't enough: browsers normalise backslashes to
 * forward slashes and strip tab/newline characters anywhere in a URL, so
 * `/\evil.example` and `/\n/evil.example` are both navigated to as
 * protocol-relative (`//evil.example`) despite "looking" like single-slash
 * paths. Rather than chase each normalisation quirk, the href is parsed
 * the same way a browser would and kept only if it resolves to our origin.
 *
 * @param {unknown} href
 * @param {string} [fallback='#'] - Returned when `href` isn't a safe
 *   relative path
 * @returns {string} `href`, or `fallback`
 */
function relativeHref (href, fallback = '#') {
  if (typeof href !== 'string' || !href.startsWith('/')) {
    return fallback
  }

  try {
    return new URL(href, SAME_ORIGIN_BASE).origin === SAME_ORIGIN_BASE ? href : fallback
  } catch {
    // e.g. `//[` - a protocol-relative URL with an unparseable host
    return fallback
  }
}

/**
 * Where a form in the side navigation sends the user back to: the page it was
 * sent from, if that is one of ours, else the hub; at `anchor`, if given.
 *
 * @param {unknown} returnTo - The page, as the form sent it
 * @param {string} [anchor] - Where on the page, without its `#`
 * @returns {string}
 */
function backTo (returnTo, anchor) {
  const [page] = relativeHref(returnTo, FALLBACK_RETURN_URL).split('#')

  return anchor ? `${page}#${anchor}` : page
}

export {
  backTo,
  relativeHref
}
