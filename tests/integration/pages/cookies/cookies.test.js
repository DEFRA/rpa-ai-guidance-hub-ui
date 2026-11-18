import { createServer } from '../../../../src/server/server.js'
import { pageOf } from '../../helpers/page.js'

function setCookies (response) {
  return [response.headers['set-cookie']].flat()
}

function postBanner (server, action, payload, headers) {
  return server.inject({
    method: 'POST',
    url: `/cookies/${action}`,
    payload,
    headers
  })
}

describe('cookies', () => {
  let server

  beforeAll(async () => {
    vi.stubEnv('GTM_CONTAINER_ID', 'GTM-TEST123')
    vi.resetModules()

    const { createServer: createWithGtm } = await import(
      '../../../../src/server/server.js'
    )
    server = await createWithGtm()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 0 })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  describe('when signed out', () => {
    test('GET /cookies shows the analytics choice', async () => {
      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/cookies'
      })
      const page = pageOf(payload)

      expect(statusCode).toBe(200)
      expect(page.getByRole('heading', { level: 1, name: 'Cookies' }))
        .toBeInTheDocument()
      expect(page.getByRole('radio', { name: 'No' })).toBeChecked()
    })

    test('GET /cookies shows Yes selected once analytics is accepted',
      async () => {
        const { payload } = await server.inject({
          method: 'GET',
          url: '/cookies',
          headers: {
            cookie: 'defra_cookies_policy=%7B%22analytics%22%3Atrue%7D'
          }
        })

        expect(pageOf(payload).getByRole('radio', { name: 'Yes' }))
          .toBeChecked()
      })

    test('the sign-in page offers the cookie banner', async () => {
      const { payload } = await server.inject({ method: 'GET', url: '/' })
      const banner = pageOf(payload).document
        .querySelector('.govuk-cookie-banner')

      expect(banner).toHaveAttribute('data-gtm-container-id', 'GTM-TEST123')
      expect(banner).not.toHaveAttribute('hidden')
    })

    test('the banner is hidden once a choice has been made', async () => {
      const { payload } = await server.inject({
        method: 'GET',
        url: '/',
        headers: { cookie: 'defra_cookies_policy_set=true' }
      })

      expect(pageOf(payload).document.querySelector('.govuk-cookie-banner'))
        .toHaveAttribute('hidden')
    })
  })

  describe('accepting from the banner', () => {
    test('returns to the page with the accepted message shown', async () => {
      const response = await postBanner(
        server, 'accept', { returnUrl: '/guides?page=2' })

      expect(response.statusCode).toBe(302)
      expect(response.headers.location)
        .toBe('/guides?page=2&cookieAction=accept')
    })

    test('stores consent for a year, readable by the client script',
      async () => {
        const response = await postBanner(server, 'accept', {})
        const policy = setCookies(response)
          .find((cookie) => cookie.startsWith('defra_cookies_policy='))

        expect(decodeURIComponent(policy.split(';')[0].split('=')[1]))
          .toBe('{"analytics":true}')
        expect(policy).toContain('Max-Age=31536000')
        expect(policy).toContain('SameSite=Lax')
        expect(policy).not.toContain('HttpOnly')
        expect(setCookies(response))
          .toContainEqual(expect.stringMatching(/^defra_cookies_policy_set=true/))
      })

    test.each([
      ['//evil.example'],
      ['https://evil.example/']
    ])('does not redirect to %s', async (returnUrl) => {
      const response = await postBanner(server, 'accept', { returnUrl })

      expect(response.headers.location).toBe('/?cookieAction=accept')
    })

    test('shows the accepted message after the redirect', async () => {
      const { payload } = await server.inject({
        method: 'GET',
        url: '/?cookieAction=accept',
        headers: { cookie: 'defra_cookies_policy_set=true' }
      })
      const banner = pageOf(payload).document
        .querySelector('.govuk-cookie-banner')
      const [main, accepted, rejected] = banner
        .querySelectorAll('.govuk-cookie-banner__message')

      expect(banner).not.toHaveAttribute('hidden')
      expect(main).toHaveAttribute('hidden')
      expect(accepted).not.toHaveAttribute('hidden')
      expect(rejected).toHaveAttribute('hidden')
    })
  })

  describe('rejecting from the banner', () => {
    test('stores a negative choice and clears Google Analytics cookies',
      async () => {
        const response = await postBanner(
          server, 'reject', { returnUrl: '/' },
          { cookie: '_ga=1; _ga_ABC=2; other=3' })
        const cookies = setCookies(response)

        expect(response.headers.location).toBe('/?cookieAction=reject')
        expect(cookies).toContainEqual(
          expect.stringMatching(/^defra_cookies_policy=%7B%22analytics%22%3Afalse%7D/))
        expect(cookies).toContainEqual(expect.stringMatching(/^_ga=;/))
        expect(cookies).toContainEqual(expect.stringMatching(/^_ga_ABC=;/))
        expect(cookies).not.toContainEqual(expect.stringMatching(/^other=/))
      })
  })

  describe('saving the form on /cookies', () => {
    test('stores the choice and confirms it', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/cookies',
        payload: { analytics: 'yes' }
      })

      expect(response.headers.location).toBe('/cookies?saved=true')
      expect(setCookies(response)).toContainEqual(
        expect.stringMatching(/^defra_cookies_policy=%7B%22analytics%22%3Atrue%7D/))
    })

    test('shows the confirmation', async () => {
      const { payload } = await server.inject({
        method: 'GET',
        url: '/cookies?saved=true'
      })

      expect(pageOf(payload).getByText('Your cookie settings were saved'))
        .toBeInTheDocument()
    })
  })
})

describe('when no GTM container is configured', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 0 })
  })

  test('the page has no cookie banner', async () => {
    const { payload } = await server.inject({ method: 'GET', url: '/' })

    expect(pageOf(payload).document.querySelector('.govuk-cookie-banner'))
      .toBeNull()
  })

  test('the cookies page has no analytics choice', async () => {
    const { payload } = await server.inject({
      method: 'GET',
      url: '/cookies'
    })

    expect(pageOf(payload).queryByRole('radio')).toBeNull()
  })
})
