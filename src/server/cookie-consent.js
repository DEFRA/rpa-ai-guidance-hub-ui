import { config } from '../config/config.js'

const CONSENT_COOKIE = 'defra_cookies_policy'
const CONSENT_SET_COOKIE = 'defra_cookies_policy_set'
const SECONDS_PER_DAY = 24 * 60 * 60
const DAYS_PER_YEAR = 365
const MS_PER_SECOND = 1000
const ONE_YEAR_MS = DAYS_PER_YEAR * SECONDS_PER_DAY * MS_PER_SECOND

/**
 * @private
 * Options for the consent cookies: readable by the client script (not
 * HttpOnly), kept for a year, and Lax rather than Strict so they are sent on
 * arrival from another site. The value is already URI-encoded JSON.
 *
 * @returns {import('@hapi/hapi').ServerStateCookieOptions}
 */
function _consentCookieOptions () {
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
 * @private
 * Whether a consent cookie's value accepts analytics.
 *
 * @param {string | undefined} cookieValue - The URI-encoded JSON value
 * @returns {boolean} False when absent, malformed or rejecting
 */
function _parseConsent (cookieValue) {
  try {
    return JSON.parse(decodeURIComponent(cookieValue || '')).analytics === true
  } catch {
    return false
  }
}

/**
 * @private
 * @param {boolean} analytics - Whether analytics cookies are accepted
 * @returns {string} The value to store in the consent cookie
 */
function _serializeConsent (analytics) {
  return encodeURIComponent(JSON.stringify({ analytics }))
}

/**
 * Whether the user has accepted analytics cookies.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {boolean} False when absent, malformed or rejecting
 */
function getConsent (request) {
  return _parseConsent(request?.state?.[CONSENT_COOKIE])
}

/**
 * Whether the user has made a choice at all, accepting or rejecting.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {boolean}
 */
function isConsentSet (request) {
  return Boolean(request?.state?.[CONSENT_SET_COOKIE])
}

/**
 * Stores the user's choice on a response. A rejection also drops any Google
 * Analytics cookies the request carried.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseObject} response
 * @param {boolean} analytics - Whether analytics cookies are accepted
 * @returns {import('@hapi/hapi').ResponseObject} The same response
 */
function setConsent (request, response, analytics) {
  response
    .state(CONSENT_COOKIE, _serializeConsent(analytics))
    .state(CONSENT_SET_COOKIE, 'true')

  if (!analytics) {
    for (const name of Object.keys(request.state ?? {})) {
      if (name.startsWith('_ga')) {
        response.unstate(name, { path: '/' })
      }
    }
  }

  return response
}

/**
 * Registers the consent cookies' state definitions and adds the consent
 * operations to every request: `request.getConsent()`,
 * `request.isConsentSet()` and `request.setConsent(response, analytics)`.
 *
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const cookieConsent = {
  plugin: {
    name: 'cookie-consent',
    register (server) {
      server.state(CONSENT_COOKIE, _consentCookieOptions())
      server.state(CONSENT_SET_COOKIE, _consentCookieOptions())

      server.decorate('request', 'getConsent', function () {
        return getConsent(this)
      })
      server.decorate('request', 'isConsentSet', function () {
        return isConsentSet(this)
      })
      server.decorate('request', 'setConsent', function (response, analytics) {
        return setConsent(this, response, analytics)
      })
    }
  }
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
  cookieConsent,
  getConsent,
  isConsentSet,
  safeReturnPath,
  setConsent
}
