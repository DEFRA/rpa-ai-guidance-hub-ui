import { config } from '../config/config.js'

const CONSENT_COOKIE = 'defra_cookies_policy'
const CONSENT_SET_COOKIE = 'defra_cookies_policy_set'
const ONE_YEAR_MS = 31536000 * 1000

/**
 * Options for the consent cookies: readable by the client script (not
 * HttpOnly), kept for a year, and Lax rather than Strict so they are sent on
 * arrival from another site. The value is already URI-encoded JSON.
 *
 * @returns {import('@hapi/hapi').ServerStateCookieOptions}
 */
function consentCookieOptions () {
  return {
    ttl: ONE_YEAR_MS,
    path: '/',
    encoding: 'none',
    isHttpOnly: false,
    isSecure: config.get('session.cookie.secure'),
    isSameSite: 'Lax',
    clearInvalid: true,
    ignoreErrors: true
  }
}

/**
 * Registers the consent cookies' state definitions.
 *
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const cookieConsent = {
  plugin: {
    name: 'cookie-consent',
    register (server) {
      server.state(CONSENT_COOKIE, consentCookieOptions())
      server.state(CONSENT_SET_COOKIE, consentCookieOptions())
    }
  }
}

/**
 * Whether a consent cookie's value accepts analytics.
 *
 * @param {string | undefined} cookieValue - The URI-encoded JSON value
 * @returns {boolean} False when absent, malformed or rejecting
 */
function parseConsent (cookieValue) {
  try {
    return JSON.parse(decodeURIComponent(cookieValue || '')).analytics === true
  } catch {
    return false
  }
}

/**
 * @param {boolean} analytics - Whether analytics cookies are accepted
 * @returns {string} The value to store in the consent cookie
 */
function serializeConsent (analytics) {
  return encodeURIComponent(JSON.stringify({ analytics }))
}

/**
 * A safe place to send the user back to. Only same-site paths pass; anything
 * else becomes '/'. A cookieAction already in the query is dropped, so the
 * caller can add its own.
 *
 * @param {unknown} value - The requested return URL
 * @returns {string} A path with its query and hash
 */
function safeReturnPath (value) {
  if (typeof value !== 'string' || !/^\/(?![/\\])/.test(value)) {
    return '/'
  }

  try {
    const url = new URL(value, 'http://localhost')
    url.searchParams.delete('cookieAction')
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}

export {
  CONSENT_COOKIE,
  CONSENT_SET_COOKIE,
  cookieConsent,
  parseConsent,
  safeReturnPath,
  serializeConsent
}
