// Google Tag Manager consent handling. The banner's forms post to
// /cookies/accept and /cookies/reject so consent persists without
// JavaScript; with it, this script intercepts the submission and loads
// analytics once the user has accepted.

const COOKIE_NAME = 'defra_cookies_policy'
const COOKIE_SET_NAME = 'defra_cookies_policy_set'
const MAX_AGE_SECONDS = 31536000
const GTM_SCRIPT_SELECTOR = 'script[src*="googletagmanager.com/gtm.js"]'

/**
 * @returns {{analytics: boolean} | null} The saved choice, or null if none
 */
function getCookieConsent () {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`))

  if (!match) {
    return null
  }

  try {
    return JSON.parse(decodeURIComponent(match.split('=')[1]))
  } catch {
    return null
  }
}

/**
 * Saves the user's choice, and that one has been made, for a year.
 *
 * @param {{analytics: boolean}} consent
 */
function setCookieConsent (consent) {
  const value = encodeURIComponent(JSON.stringify(consent))
  const attributes = `path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`

  document.cookie = `${COOKIE_NAME}=${value}; ${attributes}`
  document.cookie = `${COOKIE_SET_NAME}=true; ${attributes}`
}

/**
 * @returns {boolean} Whether the user has made a choice
 */
function hasConsentBeenSet () {
  return document.cookie
    .split('; ')
    .some((row) => row.startsWith(`${COOKIE_SET_NAME}=`))
}

/**
 * Loads Google Tag Manager once; later calls do nothing.
 *
 * @param {string | undefined} containerId - The GTM container ID
 */
function loadGoogleTagManager (containerId) {
  if (!containerId || document.querySelector(GTM_SCRIPT_SELECTOR)) {
    return
  }

  globalThis.dataLayer = globalThis.dataLayer || []
  globalThis.dataLayer.push({
    'gtm.start': Date.now(),
    event: 'gtm.js'
  })

  const script = document.createElement('script')
  script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`
  script.async = true
  document.head.appendChild(script)
}

/**
 * Expires the Google Analytics cookies, on this host and its parent domain.
 */
function removeAnalyticsCookies () {
  const parts = globalThis.location.hostname.split('.')
  const parentDomain = parts.length > 2
    ? parts.slice(1).join('.')
    : parts.join('.')

  for (const cookie of document.cookie.split('; ')) {
    const name = cookie.split('=')[0]

    if (name.startsWith('_ga')) {
      document.cookie = `${name}=; path=/; max-age=0`
      document.cookie = `${name}=; path=/; max-age=0; domain=.${parentDomain}`
    }
  }
}

function handleBannerConsent (banner, messages, containerId) {
  const [mainMessage, acceptedMessage, rejectedMessage] = messages

  for (const form of mainMessage.querySelectorAll('form')) {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const choice = form.querySelector('button').value

      if (choice === 'accept') {
        setCookieConsent({ analytics: true })
        loadGoogleTagManager(containerId)
        mainMessage.hidden = true
        acceptedMessage.hidden = false
        acceptedMessage.focus()
      }

      if (choice === 'reject') {
        setCookieConsent({ analytics: false })
        removeAnalyticsCookies()
        mainMessage.hidden = true
        rejectedMessage.hidden = false
        rejectedMessage.focus()
      }
    })
  }

  const hideButtons = banner.querySelectorAll(
    '.govuk-cookie-banner__message[role="alert"] button'
  )
  for (const hideButton of hideButtons) {
    hideButton.addEventListener('click', () => {
      banner.hidden = true
    })
  }
}

/**
 * Wires up the banner rendered in the layout. Does nothing when there is no
 * banner, which is when no Google Tag Manager container ID is configured.
 */
function initCookieBanner () {
  const banner = document.querySelector('.govuk-cookie-banner')

  if (!banner) {
    return
  }

  const containerId = banner.dataset.gtmContainerId
  const messages = banner.querySelectorAll('.govuk-cookie-banner__message')

  if (
    hasConsentBeenSet() &&
    !banner.querySelector('[role="alert"]:not([hidden])')
  ) {
    banner.hidden = true

    if (getCookieConsent()?.analytics) {
      loadGoogleTagManager(containerId)
    }
    return
  }

  // Back from the no-JavaScript accept: the accepted message is showing.
  if (!messages[1].hidden) {
    loadGoogleTagManager(containerId)
  }

  handleBannerConsent(banner, messages, containerId)
}

/**
 * Wires up the form on the cookies page, so a saved choice also takes effect
 * in the browser: loading analytics when accepted, removing it when not.
 */
function initCookiesPage () {
  const form = document.getElementById('cookies-form')

  if (!form) {
    return
  }

  form.addEventListener('submit', () => {
    const selected = form.querySelector('input[name="analytics"]:checked')

    if (!selected) {
      return
    }

    const analytics = selected.value === 'yes'
    setCookieConsent({ analytics })

    if (analytics) {
      const banner = document.querySelector('.govuk-cookie-banner')
      loadGoogleTagManager(banner?.dataset?.gtmContainerId)
    } else {
      removeAnalyticsCookies()
    }
  })
}

export {
  getCookieConsent,
  hasConsentBeenSet,
  initCookieBanner,
  initCookiesPage,
  loadGoogleTagManager,
  removeAnalyticsCookies,
  setCookieConsent
}
