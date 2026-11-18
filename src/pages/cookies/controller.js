import { config } from '../../config/config.js'
import { safeReturnPath } from '../../server/cookie-consent.js'

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
    currentAnalytics: request.getConsent(),
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

  return request.setConsent(h.redirect('/cookies?saved=true'), analytics)
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

    return request.setConsent(h.redirect(location), analytics)
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
