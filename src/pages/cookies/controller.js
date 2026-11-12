import { config } from '../../config/config.js'
import {
  CONSENT_COOKIE,
  CONSENT_SET_COOKIE,
  parseConsent,
  safeReturnPath,
  serializeConsent
} from '../../server/cookie-consent.js'

/**
 * Stores the user's choice on a response. A rejection also drops any Google
 * Analytics cookies the request carried.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseObject} response
 * @param {boolean} analytics - Whether analytics cookies are accepted
 * @returns {import('@hapi/hapi').ResponseObject} The same response
 */
function withConsent (request, response, analytics) {
  response
    .state(CONSENT_COOKIE, serializeConsent(analytics))
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
 * Shows /cookies, where a user can change their analytics choice. Public: the
 * banner that links here renders on signed-out pages too.
 *
 * @type {import('@hapi/hapi').Lifecycle.Method}
 */
function cookiesGetController (request, h) {
  return h.view('cookies/page', {
    pageTitle: 'Cookies',
    saved: request.query.saved === 'true',
    currentAnalytics: parseConsent(request.state?.[CONSENT_COOKIE]),
    gtmContainerId: config.get('googleTagManager.containerId'),
    breadcrumbs: [
      { text: 'Home', href: '/' },
      { text: 'Cookies' }
    ]
  })
}

/**
 * Stores the choice made on the /cookies form.
 *
 * @type {import('@hapi/hapi').Lifecycle.Method}
 */
function cookiesPostController (request, h) {
  const analytics = request.payload?.analytics === 'yes'

  return withConsent(request, h.redirect('/cookies?saved=true'), analytics)
}

/**
 * Builds the handler for a banner button: store the choice and return to
 * the page the banner was on.
 *
 * @param {boolean} analytics - Whether the button accepts analytics cookies
 * @returns {import('@hapi/hapi').Lifecycle.Method}
 */
function bannerController (analytics) {
  return (request, h) => {
    const returnPath = safeReturnPath(request.payload?.returnUrl)
    const url = new URL(returnPath, 'http://localhost')
    url.searchParams.set('cookieAction', analytics ? 'accept' : 'reject')
    const location = `${url.pathname}${url.search}${url.hash}`

    return withConsent(request, h.redirect(location), analytics)
  }
}

const bannerAcceptController = bannerController(true)
const bannerRejectController = bannerController(false)

export {
  bannerAcceptController,
  bannerRejectController,
  cookiesGetController,
  cookiesPostController
}
