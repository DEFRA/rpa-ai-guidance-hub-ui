function splitPair (pair) {
  const separator = pair.indexOf('=')
  return [pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()]
}

/**
 * Merges a response's `Set-Cookie` header into an existing `Cookie` header,
 * keyed by cookie name.
 *
 * A response only re-issues the cookies it actually changed - e.g. the yar
 * session cookie isn't set until the first write to session, so submitting
 * a form that starts writing to session re-issues it while leaving the auth
 * cookie alone. Replacing the whole `Cookie` header with just that
 * response's `Set-Cookie` would silently drop whichever cookie it didn't
 * mention.
 *
 * @param {string} [cookieHeader] the `Cookie` header sent on the request
 * @param {string | string[]} [setCookieHeader] the response's `Set-Cookie` header(s)
 * @returns {string} an updated `Cookie` header carrying both
 */
function mergeCookies (cookieHeader, setCookieHeader) {
  const jar = new Map((cookieHeader ?? '').split('; ').filter(Boolean).map(splitPair))

  const setCookies = setCookieHeader ? [setCookieHeader].flat() : []
  for (const setCookie of setCookies) {
    const [name, value] = splitPair(setCookie.split(';')[0])
    jar.set(name, value)
  }

  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

export { mergeCookies }
