import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { HubViewModel } from '../../../../src/pages/hub/view-models.js'
import { guidePageResponse, guideSummaryResponse, versionResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const LIST_HEADING = '<h2 class="govuk-heading-m">'

/** The headings of the lists that the page's main area shows. */
function listHeadings (main) {
  return main.split(LIST_HEADING).slice(1).map((rest) => rest.slice(0, rest.indexOf('</h2>')))
}

describe('#hubController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(() => {
    nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server?.stop({ timeout: 0 })
  })

  describe('When logged in as a dev user', () => {
    test('Should respond with 200 and render the hub page with all guides', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/hub',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('RPA Guidance hub')
      expect(payload).toContain('<h2 class="govuk-heading-m">All guides</h2>')
      expect(payload).not.toContain('Editing')
      expect(payload).not.toContain('Saved guidance')
      expect(payload).not.toContain('defra-service-navigation')
    })

    test('shows one list at a time, not tabs', async () => {
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      expect(main).not.toContain('govuk-tabs')
      expect(listHeadings(main)).toEqual(['All guides'])
    })

    test('leaves a designer\'s work to the side navigation', async () => {
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      expect(main).not.toContain('Designing')
      expect(main).not.toContain('Upload guidance')
      expect(main).not.toContain('Awaiting my review')
    })

    test('Should escape HTML in guidance items to prevent XSS vulnerabilities', async () => {
      const xssTitle = '<script>alert("xss")</script>'
      const items = [
        {
          title: xssTitle,
          href: '/guidance/xss',
          lastModified: '23 September 2026',
          version: '1',
          removeHref: '/hub/remove/xss'
        }
      ]

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ recentlyOpened: items, shown: 'recentlyOpened' }))

      expect(renderedHtml).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(renderedHtml).not.toContain(xssTitle)
      expect(renderedHtml).toContain('class="govuk-table"')
    })

    test('Should not render a javascript: href from a guidance item', async () => {
      const items = [
        {
          title: 'Untrusted href',
          href: 'javascript:alert(document.cookie)',
          lastModified: '23 September 2026',
          version: '1',
          removeHref: '//evil.example.com'
        }
      ]

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ recentlyOpened: items, shown: 'recentlyOpened' }))

      expect(renderedHtml).not.toContain('javascript:alert')
      expect(renderedHtml).not.toContain('evil.example.com')
      expect(renderedHtml).toContain('href="#"')
    })
  })

  describe('a list of guides', () => {
    test.each([
      ['/hub/recently-opened', 'Recently opened', 'You haven&#39;t opened any guidance yet.'],
      ['/hub/pinned', 'Pinned', 'You haven&#39;t pinned any guidance yet.'],
      ['/hub/bookmarked-guides', 'Bookmarked guides', 'You haven&#39;t bookmarked any guidance yet.']
    ])('%s shows only the %s list', async (url, heading, emptyMessage) => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(listHeadings(main)).toEqual([heading])
      expect(main).toContain(emptyMessage)
      expect(main).not.toContain('govuk-tabs')
    })

    test.each([
      ['/hub/recently-opened'],
      ['/hub/pinned'],
      ['/hub/bookmarked-guides']
    ])('%s does not ask the API for the guides', async (url) => {
      nock.cleanAll()
      const guides = nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
      const cookie = await loginAsDevUser(server)

      await server.inject({ method: 'GET', url, headers: { cookie } })

      expect(guides.isDone()).toBe(false)
    })

    test.each([
      ['/hub/no-such-list'],
      ['/hub/awaiting-my-review']
    ])('is not found at %s, as there is no such list', async (url) => {
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({ method: 'GET', url, headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })
  })

  describe('the All guides list', () => {
    /** The hub's main area, listing `items` as the API's one page. */
    async function hubListing (items) {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({ items }))
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      return payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
    }

    test('lists each guide as a row: its Live tag, its title linking to it, its purpose, and when it was last updated and published', async () => {
      const id = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

      const main = await hubListing([guideSummaryResponse({ id, metadata: { goal: 'Explain the claim.' } })])
      const row = main.slice(main.indexOf('<li class="app-search-results__item"'), main.indexOf('</li>'))

      expect(row).toMatch(/govuk-tag--turquoise">\s*Live\s*</)
      expect(row).toContain(`<a class="govuk-link" href="/guides/${id}">Claiming the SFI payment</a>`)
      expect(row).toContain('Explain the claim.')
      expect(row).toContain('Last updated: 6 October 2026 &middot; Published: 1 October 2026')
      expect(main).not.toContain('govuk-table')
    })

    test('escapes a guide\'s title and purpose', async () => {
      const metadata = { goal: '<img src=x onerror=alert(1)>' }

      const main = await hubListing([guideSummaryResponse({ metadata, latestVersion: versionResponse({ title: '<script>alert("xss")</script>' }) })])

      expect(main).not.toContain('<script>alert')
      expect(main).not.toContain('<img src=x')
      expect(main).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    })

    test('lists every guide, following the API\'s pages to the last, in its order', async () => {
      const FIRST = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
      const SECOND = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
      nock.cleanAll()
      const guides = nock(GUIDANCE_API_BASE_URL)
        .get('/guides').query({ limit: '100', sort: 'updated-newest' })
        .reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({ items: [guideSummaryResponse({ id: SECOND })], nextCursor: SECOND }))
        .get('/guides').query({ limit: '100', cursor: SECOND, sort: 'updated-newest' })
        .reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({ items: [guideSummaryResponse({ id: FIRST })], nextCursor: null }))
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(guides.isDone()).toBe(true)
      expect(payload.indexOf(`href="/guides/${SECOND}"`)).toBeGreaterThan(-1)
      expect(payload.indexOf(`href="/guides/${FIRST}"`)).toBeGreaterThan(payload.indexOf(`href="/guides/${SECOND}"`))
    })

    test('Should say there are no guides when there are none', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({ items: [] }))
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(payload).toContain('There are no guides yet.')
    })
  })

  describe('the filters and sort', () => {
    const COUNTS = {
      audience: [{ label: 'Processor', shortLabel: null, count: 3 }, { label: 'Checker', shortLabel: null, count: 1 }],
      system: [{ label: 'CRM', shortLabel: null, count: 3 }],
      scheme: [{ label: 'Countryside Stewardship', shortLabel: 'CS', count: 3 }]
    }

    /** The hub with `params` in its address, and the API asked for its list with them. */
    async function hubWith (params, reply = guidePageResponse({ counts: COUNTS })) {
      nock.cleanAll()
      const query = { limit: '100', sort: 'updated-newest', ...params }
      const listing = nock(GUIDANCE_API_BASE_URL).get('/guides').query(query).reply(statusCodes.HTTP_STATUS_OK, reply)
      const cookie = await loginAsDevUser(server)
      const url = `/hub?${new URLSearchParams(params)}`
      const { statusCode, payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

      return { statusCode, payload, listing, main: payload.slice(payload.indexOf('<main'), payload.indexOf('</main>')) }
    }

    test('offer the guides specific to no scheme as a scheme of their own, chosen by no_scheme', async () => {
      const withNone = { ...COUNTS, scheme: [...COUNTS.scheme, { label: null, shortLabel: null, count: 2 }] }

      const { listing, main } = await hubWith({ no_scheme: 'true' }, guidePageResponse({ counts: withNone }))
      const filters = main.slice(main.indexOf('<aside class="app-hub-filters"'), main.indexOf('</aside>'))

      expect(listing.isDone()).toBe(true)
      expect(filters).toMatch(/<legend[^>]*>\s*Scheme\s*<\/legend>/)
      expect(filters).toMatch(/name="no_scheme" type="checkbox" value="true" checked>\s*<label[^>]*>\s*Not scheme-specific <span class="app-hub-filters__count">\(2\)<\/span>/)
    })

    test('offer who it\'s for, the system used and the scheme year beside the guides, each value with its count', async () => {
      const { main } = await hubWith({})
      const filters = main.slice(main.indexOf('<aside class="app-hub-filters"'), main.indexOf('</aside>'))

      expect(filters).toContain('Filter results')
      expect(filters).toMatch(/<legend[^>]*>\s*Who it&#39;s for\s*<\/legend>/)
      expect(filters).toMatch(/value="Processor"[^>]*>\s*<label[^>]*>\s*Processor <span class="app-hub-filters__count">\(3\)<\/span>/)
      expect(filters).toMatch(/<legend[^>]*>\s*System used\s*<\/legend>/)
      expect(filters).toMatch(/name="year" type="checkbox" value="2026" checked disabled/)
      expect(filters).not.toMatch(/<legend[^>]*>\s*Scheme\s*<\/legend>/)
      expect(filters).toContain('action="/hub#guide-results"')
      expect(filters).toContain('Apply filters')
    })

    test('pass the chosen values to the API, check them, and show each as a tag that takes it away', async () => {
      const { listing, main } = await hubWith({ audience: 'Checker', system: 'CRM' })

      expect(listing.isDone()).toBe(true)
      expect(main).toMatch(/value="Checker" checked/)
      expect(main).toContain('<a class="app-filter__tag" href="/hub?system=CRM">')
      expect(main).toContain('<a class="app-filter__tag" href="/hub?audience=Checker">')
      expect(main).toContain('<a class="govuk-link app-hub-filters__clear" href="/hub">Clear filters</a>')
    })

    test('sort the list as chosen, with Most relevant offered only once search exists', async () => {
      const { listing, main } = await hubWith({ sort: 'updated-oldest' })

      expect(listing.isDone()).toBe(true)
      expect(main).toMatch(/<select class="govuk-select app-hub-results__sort-select" id="sort" name="sort" form="hub-filters" data-sort-select="true">/)
      expect(main).toMatch(/<option value="updated-oldest" selected>Oldest updated<\/option>/)
      expect(main).toMatch(/<option value="most-relevant" disabled>Most relevant<\/option>/)
      expect(main).toContain('(Most relevant once you search)')
    })

    test('answer a value the hub does not have as a bad request', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(422, { detail: 'Unknown audience Martians' })
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({ method: 'GET', url: '/hub?audience=Martians', headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('carry on to the side navigation\'s links to the hub and its lists', async () => {
      const { payload } = await hubWith({ system: 'CRM' })

      expect(payload).toContain('href="/hub/recently-opened?system=CRM"')
      expect(payload).toContain('href="/hub/pinned?system=CRM"')
      expect(payload).toMatch(/class="app-side-nav__link[^"]*" href="\/hub\?system=CRM"/)
    })
  })

  describe('when not logged in', () => {
    test('Should respond with 302 and redirect to the home page', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/hub'
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')
    })
  })
})
