import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { initiateUploadResponse } from '../../../fixtures/cdp-uploader.js'
import { guidePageResponse } from '../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../helpers/cookies.js'
import { loginAsDevUser } from '../../helpers/login.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const SIDE_NAVIGATION = '<nav class="app-side-nav" aria-label="Guidance hub">'

describe('Side navigation', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(() => {
    nock(GUIDANCE_API_BASE_URL).get('/guides').reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
    nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: 'u-1' }))
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  test.each([
    ['the hub', '/hub'],
    ['uploading a guide', '/create-guidance/upload-guide']
  ])('shows on %s when signed in', async (_name, url) => {
    const cookie = await loginAsDevUser(server)

    const { payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

    expect(payload).toContain(SIDE_NAVIGATION)
  })

  test.each([
    ['the hub', '/hub'],
    ['uploading a guide', '/create-guidance/upload-guide']
  ])('takes the place of the header on %s when signed in', async (_name, url) => {
    const cookie = await loginAsDevUser(server)

    const { payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

    expect(payload).not.toContain('class="defra-header')
    expect(payload).not.toContain('defra-service-navigation')
    expect(payload).toMatch(/<nav class="app-side-nav"[^]*class="app-side-nav__logo"[^]*class="app-side-nav__service-link"/)
  })

  test('lets the user sign out from its footer', async () => {
    const cookie = await loginAsDevUser(server)

    const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

    expect(payload).toMatch(/app-side-nav__footer"[^]*href="\/logout"[^>]*>[^<]*Sign out/)
  })

  describe('contents', () => {
    async function navOf (url) {
      const cookie = await loginAsDevUser(server)
      const { payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

      return payload.slice(payload.indexOf('<nav class="app-side-nav"'), payload.indexOf('</nav>', payload.indexOf('<nav class="app-side-nav"')))
    }

    function linkTexts (nav) {
      return [...nav.matchAll(/<a [^>]*href="([^"]+)"[^>]*>[^]*?app-side-nav__text">([^<]+)</g)]
        .map(([, href, text]) => [text, href])
    }

    test('has a search box that searches from the hub', async () => {
      const nav = await navOf('/create-guidance/upload-guide')

      expect(nav).toContain('<form class="app-side-nav__search" method="get" action="/hub" role="search">')
      expect(nav).toContain('<label class="govuk-visually-hidden" for="side-nav-search">Search or ask question</label>')
      expect(nav).toMatch(/<input [^>]*id="side-nav-search" name="search"/)
    })

    test('leaves the search to the hub\'s own search box on the hub', async () => {
      const nav = await navOf('/hub')

      expect(nav).not.toContain('app-side-nav__search')
    })

    test('links to the hub and each list of guides, then a designer\'s work, in order', async () => {
      const nav = await navOf('/hub')

      expect(linkTexts(nav)).toEqual([
        ['Hub', '/hub'],
        ['Recently opened', '/hub/recently-opened'],
        ['Pinned', '/hub/pinned'],
        ['Bookmarked guides', '/hub/bookmarked-guides'],
        ['Awaiting my review', '/hub/awaiting-my-review'],
        ['Upload guidance', '/create-guidance/upload-guide']
      ])
      expect(nav).toContain('>Designing</h2>')
    })

    test('has sections for pinned guidance and case bookmarks, empty for now', async () => {
      const nav = await navOf('/hub')

      expect(nav).toMatch(/<details class="app-side-nav__section"[^>]*>[^]*Pinned guidance[^]*You haven't pinned any guidance yet\./)
      expect(nav).toMatch(/<details class="app-side-nav__section"[^>]*>[^]*Case bookmarks[^]*You haven't bookmarked any guidance to a case yet\./)
    })

    test.each([
      ['/hub', 'Hub'],
      ['/hub/recently-opened', 'Recently opened'],
      ['/hub/pinned', 'Pinned'],
      ['/hub/bookmarked-guides', 'Bookmarked guides'],
      ['/hub/awaiting-my-review', 'Awaiting my review'],
      ['/create-guidance/upload-guide', 'Upload guidance']
    ])('marks the current page on %s', async (url, current) => {
      const nav = await navOf(url)

      const marked = [...nav.matchAll(/<a [^>]*aria-current="page"[^>]*>[^]*?app-side-nav__text">([^<]+)</g)].map(([, text]) => text)
      expect(marked).toEqual([current])
    })
  })

  describe('folding away', () => {
    async function fold (cookie, collapsed, returnTo) {
      const response = await server.inject({
        method: 'POST',
        url: '/side-nav/toggle',
        headers: { cookie },
        payload: { collapsed, returnTo }
      })

      return { response, cookie: mergeCookies(cookie, response.headers['set-cookie']) }
    }

    async function pageOf (cookie, url) {
      const { payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

      return payload
    }

    test('offers to fold the navigation away, coming back to the same page', async () => {
      const cookie = await loginAsDevUser(server)

      const payload = await pageOf(cookie, '/create-guidance/upload-guide?step=1')

      expect(payload).toMatch(/<button type="submit" form="side-nav-toggle-form"[^>]*>[^]*Collapse navigation/)
      expect(payload).toMatch(/<form id="side-nav-toggle-form" method="post" action="\/side-nav\/toggle" hidden>[^]*name="collapsed" value="true"[^]*name="returnTo" value="\/create-guidance\/upload-guide\?step=1"/)
    })

    test('folds down to its icons, back on the page it was folded on', async () => {
      const signedIn = await loginAsDevUser(server)

      const { response, cookie } = await fold(signedIn, true, '/hub')
      const payload = await pageOf(cookie, '/hub')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/hub')
      expect(payload).toContain('<nav class="app-side-nav app-side-nav--rail" aria-label="Guidance hub">')
      for (const name of ['Expand navigation', 'Hub', 'Recently opened', 'Pinned', 'Bookmarked guides', 'Awaiting my review', 'Upload guidance', 'Sign out']) {
        expect(payload).toContain(`<span class="app-side-nav__rail-label">${name}</span>`)
      }
      expect(payload).not.toContain('<span class="app-side-nav__rail-label">Pinned guidance</span>')
      expect(payload).not.toContain('<span class="app-side-nav__rail-label">Case bookmarks</span>')
      expect(payload).not.toContain('app-side-nav__search')
      expect(payload).toMatch(/name="collapsed" value="false"/)
    })

    test('keeps a designer\'s work in a list of its own, after the lists of guides', async () => {
      const signedIn = await loginAsDevUser(server)

      const { cookie } = await fold(signedIn, true, '/hub')
      const payload = await pageOf(cookie, '/hub')

      const designing = payload.indexOf('<ul class="app-side-nav__rail-list" aria-label="Designing">')
      expect(designing).toBeGreaterThan(payload.indexOf('<span class="app-side-nav__rail-label">Bookmarked guides</span>'))
      expect(payload.indexOf('<span class="app-side-nav__rail-label">Awaiting my review</span>')).toBeGreaterThan(designing)
      expect(payload.indexOf('<span class="app-side-nav__rail-label">Upload guidance</span>')).toBeGreaterThan(designing)
    })

    test('stays folded on the next page, for the session', async () => {
      const signedIn = await loginAsDevUser(server)

      const { cookie } = await fold(signedIn, true, '/hub')
      const payload = await pageOf(cookie, '/create-guidance/upload-guide')

      expect(payload).toContain('app-side-nav--rail')
    })

    test('unfolds again', async () => {
      const signedIn = await loginAsDevUser(server)

      const folded = await fold(signedIn, true, '/hub')
      const { cookie } = await fold(folded.cookie, false, '/hub')
      const payload = await pageOf(cookie, '/hub')

      expect(payload).toContain('<nav class="app-side-nav" aria-label="Guidance hub">')
      expect(payload).not.toContain('app-side-nav--rail')
    })

    test('goes back to the hub, not to another site', async () => {
      const signedIn = await loginAsDevUser(server)

      const { response } = await fold(signedIn, true, 'https://example.com/elsewhere')

      expect(response.headers.location).toBe('/hub')
    })
  })

  test('leaves the header on the sign-in page', async () => {
    const { payload } = await server.inject({ method: 'GET', url: '/' })

    expect(payload).toContain('class="defra-header')
  })

  test('does not show on the sign-in page', async () => {
    const { payload } = await server.inject({ method: 'GET', url: '/' })

    expect(payload).toContain('Sign in')
    expect(payload).not.toContain('class="app-side-nav"')
  })
})
