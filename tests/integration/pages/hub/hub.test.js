import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { HubViewModel } from '../../../../src/pages/hub/view-models.js'
import { guidePageResponse, guideSummaryResponse, pinnedGuidesResponse, pinnedSummaryResponse, pinResponse, recentlyOpenedResponse, refusalResponse, userResponse, versionResponse } from '../../../fixtures/guidance-api.js'
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
      expect(payload).toContain('<h2 class="govuk-heading-l govuk-!-margin-bottom-1">1 guide</h2>')
      expect(payload).not.toContain('Editing')
      expect(payload).not.toContain('Saved guidance')
      expect(payload).not.toContain('defra-service-navigation')
    })

    test('shows one list at a time, not tabs', async () => {
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      expect(main).not.toContain('govuk-tabs')
      expect(main.match(/<h2 class="govuk-heading-l/g)).toHaveLength(1)
      expect(listHeadings(main)).toEqual([])
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

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ bookmarkedGuides: items, shown: 'bookmarkedGuides' }))

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

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ bookmarkedGuides: items, shown: 'bookmarkedGuides' }))

      expect(renderedHtml).not.toContain('javascript:alert')
      expect(renderedHtml).not.toContain('evil.example.com')
      expect(renderedHtml).toContain('href="#"')
    })
  })

  describe('a list of guides', () => {
    test.each([
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

    test('lists each guide as a row: its version and Live tags, its title linking to it, its purpose, and when it was last updated and published', async () => {
      const id = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

      const main = await hubListing([guideSummaryResponse({ id, metadata: { goal: 'Explain the claim.' } })])
      const row = main.slice(main.indexOf('<li class="app-search-results__item"'), main.indexOf('</li>'))

      expect(row).toMatch(/govuk-tag--green">\s*Version 1\.0\s*</)
      expect(row).toMatch(/govuk-tag--turquoise">\s*Live\s*</)
      expect(row).toContain(`<a class="govuk-link" href="/guides/${id}">Claiming the SFI payment</a>`)
      expect(row).toContain('Explain the claim.')
      expect(row).toContain('Last updated: 6 October 2026 &middot; Published: 1 October 2026')
      expect(main).not.toContain('govuk-table')
    })

    test('tags no version for a guide whose version has no number', async () => {
      const main = await hubListing([guideSummaryResponse({ latestVersion: versionResponse({ versionNumber: null }) })])

      expect(main).not.toMatch(/>\s*Version /)
      expect(main).toMatch(/govuk-tag--turquoise">\s*Live\s*</)
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

    test('heads the list with how many guides there are, and says which it is showing', async () => {
      const main = await hubListing([guideSummaryResponse({ id: 'guide-1' }), guideSummaryResponse({ id: 'guide-2' })])

      expect(main).toContain('<h2 class="govuk-heading-l govuk-!-margin-bottom-1">2 guides</h2>')
      expect(main).toMatch(/<p class="govuk-body govuk-!-margin-bottom-1 app-hub-results__showing">\s*Showing 1 to 2\s*<\/p>/)
    })

    test('Should say there are no guides when there are none, showing none', async () => {
      const main = await hubListing([])

      expect(main).toContain('0 guides')
      expect(main).toContain('There are no guides yet.')
      expect(main).not.toContain('Showing')
    })
  })

  describe('the search box', () => {
    /** The hub's green hero, at `url`. */
    async function hero (url) {
      const cookie = await loginAsDevUser(server)
      const { payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

      return { payload, hero: payload.slice(payload.indexOf('<div class="defra-hero defra-hero--hub'), payload.indexOf('id="hub-filters"')) }
    }

    test('sits in the hero beside the side navigation, asking for words or a question', async () => {
      const { hero: area, payload } = await hero('/hub')

      expect(area).toMatch(/<form class="defra-hero__search" action="\/hub" method="get" role="search">/)
      expect(area).toMatch(/<label class="govuk-visually-hidden" for="hub-search">\s*Search or ask question\s*<\/label>/)
      expect(area).toMatch(/<input class="govuk-input defra-search-bar__input" id="hub-search" name="q" type="search"[^>]*placeholder="Search or ask a question about all guidance"/)
      expect(area).toMatch(/<button class="defra-search-bar__button defra-search-bar__button--on-green" type="submit">\s*<span class="govuk-visually-hidden">Search<\/span>/)
      expect(payload).not.toContain('Search guidance')
    })

    test('keeps the words searched for, in the box and in the filters', async () => {
      const { hero: area, payload } = await hero('/hub?q=claim+rules')

      expect(area).toMatch(/id="hub-search" name="q" type="search"[^>]*value="claim rules"/)
      expect(payload).toContain('<input type="hidden" name="q" value="claim rules">')
    })

    test('escapes the words searched for', async () => {
      const { payload } = await hero('/hub?q=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E')

      expect(payload).not.toContain('<script>alert(1)')
      expect(payload).toContain('value="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
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

    test('show a value the hub no longer has as a box that cannot be ticked, as choosing it would be refused', async () => {
      const retired = { ...COUNTS, system: [...COUNTS.system, { label: 'Old system', shortLabel: null, count: 2, retired: true }] }

      const { main } = await hubWith({}, guidePageResponse({ counts: retired }))

      expect(main).toMatch(/value="Old system" disabled>\s*<label[^>]*>\s*Old system <span class="app-hub-filters__count">\(2\)<\/span>/)
      expect(main).toMatch(/value="CRM">\s*<label/)
    })

    test('say that no guides match when the chosen values leave none', async () => {
      const { main } = await hubWith({ system: 'CRM' }, guidePageResponse({ items: [], counts: COUNTS }))

      expect(main).toContain('No guides match your search or filters. Try removing some filters or using different search terms.')
      expect(main).not.toContain('There are no guides yet.')
    })

    test('answer a value the hub does not have as a bad request', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(422, refusalResponse({ detail: 'Unknown audience Martians' }))
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

  describe('pins', () => {
    const { id: USER_ID } = userResponse()
    const PINNED = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
    const OTHER = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

    async function signedIn (user) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse(user))

      return loginAsDevUser(server)
    }

    test('come first in the hub\'s list, tagged Pinned, each row with a star that pins or unpins it', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({
        items: [guideSummaryResponse({ id: OTHER }), guideSummaryResponse({ id: PINNED })]
      }))
      const cookie = await signedIn({ pinned: [pinResponse({ id: PINNED, title: 'Claiming the SFI payment' })] })

      const { payload } = await server.inject({ method: 'GET', url: '/hub?system=CRM', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      const [first, second] = main.split('<li class="app-search-results__item').slice(1)

      expect(first).toContain(`/guides/${PINNED}`)
      expect(first).toMatch(/app-search-results__pinned-tag">Pinned</)
      expect(first).toContain('<input type="hidden" name="pin" value="false">')
      expect(first).toContain('<input type="hidden" name="position" value="0">')
      expect(first).toMatch(/aria-pressed="true"/)
      expect(second).toContain(`/guides/${OTHER}`)
      expect(second).not.toContain('Pinned<')
      expect(second).toContain('<input type="hidden" name="pin" value="true">')
      expect(second).toContain('<input type="hidden" name="returnTo" value="/hub?system=CRM">')
      expect(second).toContain(`id="pin-${OTHER}"`)
    })

    test('count a guide as pinned only when it is pinned whole, at its own place among the pins', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({
        items: [guideSummaryResponse({ id: OTHER }), guideSummaryResponse({ id: PINNED })]
      }))
      const section = { sectionId: '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d99', section: '1-pay', heading: '1 Pay' }
      const cookie = await signedIn({ pinned: [pinResponse({ id: OTHER, ...section }), pinResponse({ id: PINNED }), pinResponse({ id: PINNED, ...section })] })

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      const [first, second] = main.split('<li class="app-search-results__item').slice(1)

      expect(first).toContain(`/guides/${PINNED}`)
      expect(first).toContain('<input type="hidden" name="position" value="1">')
      expect(first).toContain(`data-reorder-follows="${PINNED}"`)
      expect(second).toContain(`/guides/${OTHER}`)
      expect(second).toContain('<input type="hidden" name="pin" value="true">')
      expect(second).not.toContain('data-reorder-follows')
    })

    test.each([
      ['pins at the top', { pin: 'true' }, [{ op: 'add', path: '/0', value: { guideId: OTHER } }]],
      ['unpins from where the page showed it', { pin: 'false', position: '2' }, [
        { op: 'test', path: '/2/guideId', value: OTHER },
        { op: 'test', path: '/2/sectionId', value: null },
        { op: 'remove', path: '/2' }
      ]]
    ])('a star %s, through the hub, then goes back to it', async (_name, form, patch) => {
      nock.cleanAll()
      const cookie = await signedIn({})
      const patching = nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/pins`, patch).reply(statusCodes.HTTP_STATUS_NO_CONTENT)

      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/pin-toggle',
        headers: { cookie },
        payload: { guideId: OTHER, returnTo: '/hub?system=CRM', anchor: `pin-${OTHER}`, ...form }
      })

      expect(patching.isDone()).toBe(true)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe(`/hub?system=CRM#pin-${OTHER}`)
    })

    test('list on their own page in the user\'s order, beside the filters, without a sort', async () => {
      nock.cleanAll()
      // The list says where each guide is among all the pins; the user's record,
      // read for the side navigation, may say otherwise if they changed between.
      const cookie = await signedIn({ pinned: [pinResponse({ id: PINNED, title: 'Claiming the SFI payment' })] })
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/pins`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({
        items: [pinnedSummaryResponse({ id: PINNED, position: 1 })]
      }))

      const { statusCode, payload } = await server.inject({ method: 'GET', url: '/hub/pinned?system=CRM', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(main).toContain('1 pin<')
      expect(main).toContain(`/guides/${PINNED}`)
      expect(main).toMatch(/app-search-results__pinned-tag">Pinned</)
      expect(main).toContain('<input type="hidden" name="position" value="1">')
      expect(main).toContain('action="/hub/pinned#guide-results"')
      expect(main).not.toContain('name="sort"')
    })

    test('list a pinned section on their own page as a row of its own, by its heading, linking to the section, with its guide\'s title', async () => {
      nock.cleanAll()
      const SECTION = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d99'
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/pins`).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({
        items: [
          pinnedSummaryResponse({ id: PINNED, sectionId: SECTION, section: '1-pay', heading: '1 Pay' }),
          pinnedSummaryResponse({ id: PINNED, position: 1 })
        ]
      }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/pinned', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      const [section, guide] = main.split('<li class="app-search-results__item').slice(1)

      expect(main).toContain('2 pins<')
      expect(section).toContain(`<a class="govuk-link" href="/guides/${PINNED}?section=1-pay">1 Pay</a>`)
      expect(section).toContain('In Claiming the SFI payment')
      expect(section).toContain(`data-reorder-follows="${PINNED}/${SECTION}"`)
      expect(section).toContain('<input type="hidden" name="position" value="0">')
      expect(section).toContain(`<input type="hidden" name="sectionId" value="${SECTION}">`)
      expect(section).toContain(`<input type="hidden" name="anchor" value="pin-${SECTION}">`)
      expect(section).toContain(`id="pin-${SECTION}"`)
      expect(guide).toContain(`<a class="govuk-link" href="/guides/${PINNED}">Claiming the SFI payment</a>`)
      expect(guide).toContain('<input type="hidden" name="position" value="1">')
      expect(guide).not.toContain('name="sectionId"')
      expect(guide).toContain(`id="pin-${PINNED}"`)
    })

    test('count a guide once in their own page\'s filters, as the API counts it, however many of its pins the page lists', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/pins`).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({
        items: [
          pinnedSummaryResponse({ id: PINNED, sectionId: '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d99', section: '1-pay', heading: '1 Pay' }),
          pinnedSummaryResponse({ id: PINNED, position: 1 })
        ],
        counts: { audience: [{ label: 'Processor', shortLabel: null, count: 1 }], system: [], scheme: [] }
      }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/pinned', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      const filters = main.slice(main.indexOf('<aside class="app-hub-filters"'), main.indexOf('</aside>'))

      expect(main).toContain('2 pins<')
      expect(filters).toMatch(/value="Processor"[^>]*>\s*<label[^>]*>\s*Processor <span class="app-hub-filters__count">\(1\)<\/span>/)
      expect(filters).toMatch(/value="2026" checked disabled>\s*<label[^>]*>\s*2026 <span class="app-hub-filters__count">\(1\)<\/span>/)
    })

    test('say on their own page when nothing is pinned yet', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/pins`).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/pinned', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))

      expect(main).toContain('You haven&#39;t pinned any guidance yet. Select &#39;Pin guide&#39; on a guide to add it here.')
    })

    test('say on their own page when nothing is pinned yet, even with filters chosen', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/pins`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({ items: [] }))
        .get(`/users/${USER_ID}/pins`).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/pinned?system=CRM', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))

      expect(main).toContain('You haven&#39;t pinned any guidance yet. Select &#39;Pin guide&#39; on a guide to add it here.')
      expect(main).not.toContain('No guides match')
    })

    test('say when the chosen filters leave none of them', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/pins`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({ items: [] }))
        .get(`/users/${USER_ID}/pins`).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse())

      const { payload } = await server.inject({ method: 'GET', url: '/hub/pinned?system=CRM', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))

      expect(main).toContain('No guides match your search or filters.')
      expect(main).not.toContain('You haven&#39;t pinned')
    })

    test('an unpin without the position the page showed is refused', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({
        method: 'POST', url: '/pin-toggle', headers: { cookie }, payload: { guideId: OTHER, pin: 'false', returnTo: '/hub' }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
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

  describe('recently opened guides', () => {
    const { id: USER_ID } = userResponse()
    const NEWER = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
    const OLDER = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

    async function signedIn (user) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse(user))

      return loginAsDevUser(server)
    }

    test('list on their own page newest first, beside the filters, without a sort, each with its star', async () => {
      nock.cleanAll()
      const cookie = await signedIn({ pinned: [pinResponse({ id: OLDER, title: 'Claiming the SFI payment' })] })
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/recently-opened`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({
        items: [
          guideSummaryResponse({ id: NEWER, latestVersion: versionResponse({ title: 'Closing a case' }), openedAt: '2026-11-03T17:00:00' }),
          guideSummaryResponse({ id: OLDER, openedAt: '2026-11-03T16:00:00' })
        ],
        counts: { audience: [], system: [{ label: 'CRM', shortLabel: null, count: 2, retired: false }], scheme: [] }
      }))

      const { statusCode, payload } = await server.inject({ method: 'GET', url: '/hub/recently-opened?system=CRM', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      const [newer, older] = main.split('<li class="app-search-results__item').slice(1)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(main).toContain('2 recently opened guides<')
      expect(newer).toContain(`/guides/${NEWER}`)
      expect(newer).toContain('<input type="hidden" name="pin" value="true">')
      expect(older).toContain(`/guides/${OLDER}`)
      expect(older).toMatch(/app-search-results__pinned-tag">Pinned</)
      expect(older).toContain('<input type="hidden" name="position" value="0">')
      expect(main).toContain('action="/hub/recently-opened#guide-results"')
      expect(main).not.toContain('name="sort"')
    })

    test('say on their own page when none has been opened yet', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/recently-opened', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))

      expect(main).toContain('You haven&#39;t opened any guidance yet. Any guidance you open will appear here.')
    })

    test('say on their own page when none has been opened yet, even with filters chosen', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/recently-opened`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({ items: [] }))
        .get(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/recently-opened?system=CRM', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))

      expect(main).toContain('You haven&#39;t opened any guidance yet. Any guidance you open will appear here.')
      expect(main).not.toContain('No guides match')
    })

    test('say when the chosen filters leave none of them', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/recently-opened`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({ items: [] }))
        .get(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse())

      const { payload } = await server.inject({ method: 'GET', url: '/hub/recently-opened?system=CRM', headers: { cookie } })
      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))

      expect(main).toContain('No guides match your search or filters.')
      expect(main).not.toContain('You haven&#39;t opened')
    })
  })
})
