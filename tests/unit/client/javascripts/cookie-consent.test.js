// @vitest-environment jsdom
import {
  getCookieConsent,
  hasConsentBeenSet,
  initCookieBanner,
  initCookiesPage,
  loadGoogleTagManager,
  removeAnalyticsCookies,
  setCookieConsent
} from '../../../../src/client/javascripts/cookie-consent.js'

const GTM_SCRIPT = 'script[src*="googletagmanager.com/gtm.js"]'

function clearCookies () {
  for (const cookie of document.cookie.split('; ')) {
    document.cookie = `${cookie.split('=')[0]}=; path=/; max-age=0`
  }
}

function bannerHtml ({ hidden = '', accepted = ' hidden' } = {}) {
  return `
    <div class="govuk-cookie-banner" data-gtm-container-id="GTM-TEST123"${hidden}>
      <div class="govuk-cookie-banner__message">
        <form><button value="accept">Accept</button></form>
        <form><button value="reject">Reject</button></form>
      </div>
      <div class="govuk-cookie-banner__message" role="alert"${accepted}>
        <button type="button">Hide</button>
      </div>
      <div class="govuk-cookie-banner__message" role="alert" hidden>
        <button type="button">Hide</button>
      </div>
    </div>`
}

function messagesOf () {
  return [...document.querySelectorAll('.govuk-cookie-banner__message')]
}

function submit (form) {
  form.dispatchEvent(new Event('submit', { cancelable: true }))
}

beforeEach(() => {
  clearCookies()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  delete globalThis.dataLayer
})

describe('cookie consent storage', () => {
  test('a saved choice reads back', () => {
    setCookieConsent({ analytics: true })

    expect(getCookieConsent()).toEqual({ analytics: true })
    expect(hasConsentBeenSet()).toBe(true)
  })

  test('there is no choice until one is saved', () => {
    expect(getCookieConsent()).toBeNull()
    expect(hasConsentBeenSet()).toBe(false)
  })

  test('a cookie that is not JSON is no choice', () => {
    document.cookie = 'defra_cookies_policy=oops; path=/'

    expect(getCookieConsent()).toBeNull()
  })
})

describe('loadGoogleTagManager', () => {
  test('adds the Tag Manager script for the container', () => {
    loadGoogleTagManager('GTM-TEST123')

    expect(document.querySelector(GTM_SCRIPT))
      .toHaveAttribute('src', 'https://www.googletagmanager.com/gtm.js?id=GTM-TEST123')
  })

  test('adds it only once', () => {
    loadGoogleTagManager('GTM-TEST123')
    loadGoogleTagManager('GTM-TEST123')

    expect(document.querySelectorAll(GTM_SCRIPT)).toHaveLength(1)
  })

  test('adds nothing without a container ID', () => {
    loadGoogleTagManager(undefined)

    expect(document.querySelector(GTM_SCRIPT)).toBeNull()
  })
})

describe('removeAnalyticsCookies', () => {
  test('removes Google Analytics cookies and leaves the rest', () => {
    document.cookie = '_ga=1; path=/'
    document.cookie = '_ga_ABC=2; path=/'
    document.cookie = 'other=3; path=/'

    removeAnalyticsCookies()

    expect(document.cookie).toBe('other=3')
  })
})

describe('initCookieBanner', () => {
  test('does nothing when the page has no banner', () => {
    expect(() => initCookieBanner()).not.toThrow()
  })

  describe('when no choice has been made', () => {
    beforeEach(() => {
      document.body.innerHTML = bannerHtml()
      initCookieBanner()
    })

    test('accepting saves the choice, loads analytics and says so', () => {
      submit(document.querySelector('form'))

      const [main, accepted] = messagesOf()
      expect(getCookieConsent()).toEqual({ analytics: true })
      expect(document.querySelector(GTM_SCRIPT)).not.toBeNull()
      expect(main).toHaveAttribute('hidden')
      expect(accepted).not.toHaveAttribute('hidden')
    })

    test('rejecting saves the choice, loads nothing and says so', () => {
      document.cookie = '_ga=1; path=/'

      submit(document.querySelectorAll('form')[1])

      const [main, , rejected] = messagesOf()
      expect(getCookieConsent()).toEqual({ analytics: false })
      expect(document.cookie).not.toContain('_ga=')
      expect(document.querySelector(GTM_SCRIPT)).toBeNull()
      expect(main).toHaveAttribute('hidden')
      expect(rejected).not.toHaveAttribute('hidden')
    })

    test('hiding the message hides the banner', () => {
      document.querySelectorAll('[role="alert"] button')[0].click()

      expect(document.querySelector('.govuk-cookie-banner'))
        .toHaveAttribute('hidden')
    })
  })

  describe('when analytics was accepted earlier', () => {
    test('hides the banner and loads analytics', () => {
      setCookieConsent({ analytics: true })
      document.body.innerHTML = bannerHtml({ hidden: ' hidden' })

      initCookieBanner()

      expect(document.querySelector('.govuk-cookie-banner'))
        .toHaveAttribute('hidden')
      expect(document.querySelector(GTM_SCRIPT)).not.toBeNull()
    })
  })

  describe('when analytics was rejected earlier', () => {
    test('hides the banner and loads nothing', () => {
      setCookieConsent({ analytics: false })
      document.body.innerHTML = bannerHtml({ hidden: ' hidden' })

      initCookieBanner()

      expect(document.querySelector(GTM_SCRIPT)).toBeNull()
    })
  })

  describe('when the server has just accepted without JavaScript', () => {
    test('loads analytics and keeps the accepted message', () => {
      setCookieConsent({ analytics: true })
      document.body.innerHTML = bannerHtml({ accepted: '' })

      initCookieBanner()

      expect(document.querySelector(GTM_SCRIPT)).not.toBeNull()
      expect(document.querySelector('.govuk-cookie-banner'))
        .not.toHaveAttribute('hidden')
    })
  })
})

describe('initCookiesPage', () => {
  function pageHtml (value) {
    return `
      ${bannerHtml()}
      <form id="cookies-form">
        <input type="radio" name="analytics" value="yes"${value === 'yes' ? ' checked' : ''}>
        <input type="radio" name="analytics" value="no"${value === 'no' ? ' checked' : ''}>
      </form>`
  }

  test('does nothing when the page has no cookies form', () => {
    expect(() => initCookiesPage()).not.toThrow()
  })

  test('saving Yes stores the choice and loads analytics', () => {
    document.body.innerHTML = pageHtml('yes')
    initCookiesPage()

    submit(document.getElementById('cookies-form'))

    expect(getCookieConsent()).toEqual({ analytics: true })
    expect(document.querySelector(GTM_SCRIPT)).not.toBeNull()
  })

  test('saving No stores the choice and removes Google Analytics cookies', () => {
    document.cookie = '_ga=1; path=/'
    document.body.innerHTML = pageHtml('no')
    initCookiesPage()

    submit(document.getElementById('cookies-form'))

    expect(getCookieConsent()).toEqual({ analytics: false })
    expect(document.cookie).not.toContain('_ga=')
    expect(document.querySelector(GTM_SCRIPT)).toBeNull()
  })

  test('saving without choosing stores nothing', () => {
    document.body.innerHTML = pageHtml()
    initCookiesPage()

    submit(document.getElementById('cookies-form'))

    expect(getCookieConsent()).toBeNull()
  })
})
