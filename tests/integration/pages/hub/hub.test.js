import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { HubViewModel } from '../../../../src/pages/hub/view-models.js'
import * as searchApi from '../../../fixtures/search-api.js'
import { bookmarkedGuidesResponse, caseResponse, guidePageResponse, guideResponse, guideSummaryResponse, pinnedGuidesResponse, pinnedSummaryResponse, pinResponse, recentlyOpenedResponse, refusalResponse, userResponse, versionResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf, sideNavOf, textOf } from '../../helpers/page.js'
import { BOOKMARK_MESSAGES, HUB_MESSAGES } from '../../../fixtures/messages.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const SEARCH_API_BASE_URL = config.get('searchApi.baseUrl')

/** The text of each element, its spacing collapsed, as a reader sees it. */
function textsOf (elements) {
  return elements.map((element) => element.textContent.replaceAll(/\s+/g, ' ').trim())
}

/** Each guide the list shows, as its row: an item with the guide's title as its heading. */
function rowsOf (page) {
  return page.getAllByRole('heading', { level: 3 })
    .map((heading) => heading.closest('li'))
    .filter(Boolean)
    .map((row) => within(row))
}

/** The form that a row's star sends, to pin or unpin its guide or section. */
function starFormOf (row, options = {}) {
  return row.getByRole('button', { name: /^Pin /, ...options }).form
}

/** The filter panel beside a list, found as a screen reader finds it. */
function filtersOf (page) {
  return within(page.getByRole('complementary', { name: 'Filter results' }))
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

      const page = pageOf(payload)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.getByRole('heading', { level: 1, name: 'RPA Guidance hub' })).toBeInTheDocument()
      expect(page.getByRole('heading', { level: 2, name: '1 guide' })).toBeInTheDocument()
      expect(page.document.body).not.toHaveTextContent('Editing')
      expect(page.document.body).not.toHaveTextContent('Saved guidance')
      expect(within(page.document.body).getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))).toEqual(['Guidance hub'])
    })

    test('shows one list at a time, not tabs', async () => {
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      const page = pageOf(payload)
      expect(page.queryByRole('tablist')).not.toBeInTheDocument()
      expect(textsOf(page.getAllByRole('heading', { level: 2 }))).toEqual(['Filter results', '1 guide'])
    })

    test('leaves a maintainer\'s work to the side navigation', async () => {
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      const main = pageOf(payload).document.querySelector('main')
      expect(main).not.toHaveTextContent('Maintenance')
      expect(main).not.toHaveTextContent('Upload guidance')
      expect(main).not.toHaveTextContent('Awaiting my review')
    })

    /** A guide as a list's row takes it, by `title` and `href`. */
    function listedGuide (title, href) {
      return { id: 'guide-1', pin: null, title, href, versionNumber: '1.0', purpose: null, lastUpdated: '23 September 2026', published: '1 September 2026' }
    }

    test('Should escape HTML in guidance items to prevent XSS vulnerabilities', async () => {
      const xssTitle = '<script>alert("xss")</script>'

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ bookmarkedGuides: [listedGuide(xssTitle, '/guides/xss')], shown: 'bookmarkedGuides' }))

      const page = pageOf(renderedHtml)
      expect(page.getByRole('link', { name: xssTitle })).toHaveAttribute('href', '/guides/xss')
      expect(page.document.querySelector('main script')).toBeNull()
    })

    test('Should not render a javascript: href from a guidance item', async () => {
      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ bookmarkedGuides: [listedGuide('Untrusted href', 'javascript:alert(document.cookie)')], shown: 'bookmarkedGuides' }))

      expect(pageOf(renderedHtml).getByRole('link', { name: 'Untrusted href' })).toHaveAttribute('href', '#')
    })
  })

  describe('a list of guides', () => {
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
    /** The hub's page, listing `items` as the API's one page. */
    async function hubListing (items) {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({ items }))
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      return pageOf(payload)
    }

    test('lists each guide as a row: its version and Live tags, its title linking to it, its purpose, and when it was last updated and published', async () => {
      const id = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

      const page = await hubListing([guideSummaryResponse({ id, metadata: { goal: 'Explain the claim.' } })])
      const [row] = rowsOf(page)

      expect(row.getByText('Version 1.0')).toHaveClass('govuk-tag--green')
      expect(row.getByText('Live')).toHaveClass('govuk-tag--turquoise')
      expect(row.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${id}`)
      expect(row.getByText('Explain the claim.')).toBeInTheDocument()
      expect(row.getByText('Last updated: 6 October 2026 · Published: 1 October 2026')).toBeInTheDocument()
      expect(page.queryByRole('table')).not.toBeInTheDocument()
    })

    test('tags no version for a guide whose version has no number', async () => {
      const page = await hubListing([guideSummaryResponse({ latestVersion: versionResponse({ versionNumber: null }) })])

      expect(page.queryByText(/^Version /)).not.toBeInTheDocument()
      expect(page.getByText('Live')).toHaveClass('govuk-tag--turquoise')
    })

    test('escapes a guide\'s title and purpose', async () => {
      const metadata = { goal: '<img src=x onerror=alert(1)>' }

      const page = await hubListing([guideSummaryResponse({ metadata, latestVersion: versionResponse({ title: '<script>alert("xss")</script>' }) })])

      expect(page.getByRole('link', { name: '<script>alert("xss")</script>' })).toBeInTheDocument()
      expect(page.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
      expect(page.document.querySelector('main script, main img')).toBeNull()
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

      const links = rowsOf(pageOf(payload)).map((row) => row.getByRole('link', { name: 'Claiming the SFI payment' }).getAttribute('href'))
      expect(guides.isDone()).toBe(true)
      expect(links).toEqual([`/guides/${SECOND}`, `/guides/${FIRST}`])
    })

    test('heads the list with how many guides there are, and says which it is showing', async () => {
      const page = await hubListing([guideSummaryResponse({ id: 'guide-1' }), guideSummaryResponse({ id: 'guide-2' })])

      expect(page.getByRole('heading', { level: 2, name: '2 guides' })).toBeInTheDocument()
      expect(page.getByText('Showing 1 to 2')).toBeInTheDocument()
    })

    test('Should say there are no guides when there are none, showing none', async () => {
      const page = await hubListing([])

      expect(page.getByRole('heading', { level: 2, name: '0 guides' })).toBeInTheDocument()
      expect(page.getByText(HUB_MESSAGES.noGuides)).toBeInTheDocument()
      expect(page.queryByText(/^Showing/)).not.toBeInTheDocument()
    })
  })

  describe('the search box', () => {
    /** The hub's page at `url`, and its search box, in the hero with its heading. */
    async function hubAt (url) {
      const cookie = await loginAsDevUser(server)
      const { payload } = await server.inject({ method: 'GET', url, headers: { cookie } })
      const page = pageOf(payload)

      return { page, search: within(page.getByRole('search')) }
    }

    test('sits in the hero beside the side navigation, asking for words or a question', async () => {
      const { page, search } = await hubAt('/hub')

      const form = page.getByRole('search')
      const box = search.getByRole('searchbox', { name: 'Search or ask question' })
      expect(page.getByRole('heading', { level: 1, name: 'RPA Guidance hub' }).parentElement).toContainElement(form)
      expect(form).toHaveAttribute('action', '/hub')
      expect(form).toHaveAttribute('method', 'get')
      expect(box).toHaveAttribute('name', 'q')
      expect(box).toHaveAttribute('maxlength', '500')
      expect(box).toHaveAttribute('placeholder', 'Search or ask a question about all guidance')
      expect(search.getByRole('button', { name: 'Search' })).toHaveAttribute('type', 'submit')
      expect(page.document.body).not.toHaveTextContent('Search guidance')
    })

    test('keeps the words searched for in the box', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse())

      const { page, search } = await hubAt('/hub?q=claim+rules')

      expect(page.document.getElementById('search-results')).not.toBeNull()
      expect(search.getByRole('searchbox', { name: 'Search or ask question' })).toHaveValue('claim rules')
    })

    test('escapes the words searched for', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ results: [], total: 0 }))

      const { page, search } = await hubAt('/hub?q=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E')

      expect(page.document.getElementById('search-results')).not.toBeNull()
      expect(search.getByRole('searchbox', { name: 'Search or ask question' })).toHaveValue('"><script>alert(1)</script>')
      expect(page.document.querySelector('main script')).toBeNull()
    })
  })

  describe('searching', () => {
    /** The page's main area, at `url`. */
    async function mainOf (url) {
      const cookie = await loginAsDevUser(server)
      const { statusCode, payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

      return { statusCode, main: payload.slice(payload.indexOf('<main'), payload.indexOf('</main>')) }
    }

    const GUIDE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

    test('asks the search service for the first page of guides with the words, each with its best sections', async () => {
      const search = nock(SEARCH_API_BASE_URL)
        .get('/v1/search')
        .query({ q: 'claim rules', group: 'document', sections: '3', limit: '10', offset: '0' })
        .reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse())

      const { main } = await mainOf('/hub?q=claim+rules')

      expect(search.isDone()).toBe(true)
      expect(main).toContain('id="search-results"')
      expect(main).toContain('Countryside Stewardship final payments')
    })

    test('asks for the page of guides the address asks for', async () => {
      const search = nock(SEARCH_API_BASE_URL)
        .get('/v1/search')
        .query({ q: 'claim', group: 'document', sections: '3', limit: '10', offset: '20' })
        .reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ total: 35 }))

      const { main } = await mainOf('/hub?q=claim&page=3')

      expect(search.isDone()).toBe(true)
      expect(main).toContain('id="search-results"')
      expect(main).toContain('Countryside Stewardship final payments')
    })

    test('shows each guide found with its sections, linked to them, their words marked, instead of the list and filters', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse())

      const { statusCode, main } = await mainOf('/hub?q=claim')

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(main).toContain('<h2 class="govuk-heading-l govuk-!-margin-bottom-1">1 guide</h2>')
      expect(main).toContain(`<a class="govuk-link" href="/guides/${GUIDE}">Countryside Stewardship final payments</a>`)
      expect(main).toContain('1 section with these words')
      expect(main).toContain(`<a class="govuk-link" href="/guides/${GUIDE}?section=claim-rules#claim-rules">4.2 Claim rules</a>`)
      expect(main).toContain('2 matches')
      expect(main).toContain('Check the <mark class="app-search-match">claim</mark> was made on time.')
      expect(main).toContain('<a class="govuk-link" href="/hub">Clear search</a>')
      expect(main).not.toContain('See all')
      expect(main).not.toContain('id="hub-filters"')
      expect(main).not.toContain('id="guide-results"')
    })

    test('links to every section of a guide that has more than it shows', async () => {
      const document = searchApi.documentResult({ sectionTotal: 25 })
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ results: [document] }))

      const { main } = await mainOf('/hub?q=claim+rules')

      expect(main).toContain(`<a class="govuk-link" href="/hub?q=claim+rules&amp;guide=${GUIDE}">See all 25 sections in this guide<span class="govuk-visually-hidden">: Countryside Stewardship final payments</span></a>`)
    })

    test('searches inside one guide, a page of its sections at a time, with a way back to every guide', async () => {
      const search = nock(SEARCH_API_BASE_URL)
        .get('/v1/search')
        .query({ q: 'claim rules', tag: GUIDE, limit: '10', offset: '10' })
        .reply(statusCodes.HTTP_STATUS_OK, searchApi.searchResponse({ total: 25 }))

      const { main } = await mainOf(`/hub?q=claim+rules&guide=${GUIDE}&page=2`)

      expect(search.isDone()).toBe(true)
      expect(main).toContain('<h2 class="govuk-heading-l govuk-!-margin-bottom-1">25 sections</h2>')
      expect(main).toContain('In Countryside Stewardship final payments')
      expect(main).toMatch(/<a href="\/hub\?q=claim\+rules" class="govuk-back-link">All guides with these words<\/a>/)
      expect(main).toContain(`<a class="govuk-link" href="/guides/${GUIDE}?section=claim-rules#claim-rules">4.2 Claim rules</a>`)
      expect(main).toContain(`href="/hub?q=claim+rules&amp;guide=${GUIDE}&amp;page=3"`)
    })

    test('escapes what the search service sends', async () => {
      const section = searchApi.sectionResult({ heading: '<img src=x onerror=alert(1)>', snippet: [{ text: '<script>alert(1)</script>', match: true }] })
      const document = searchApi.documentResult({ documentTitle: '<b>bold</b>', sections: [section] })
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ results: [document] }))

      const { main } = await mainOf('/hub?q=claim')

      expect(main).not.toContain('<img src=x')
      expect(main).not.toContain('<b>bold')
      expect(main).not.toContain('<script>alert(1)')
      expect(main).toContain('<mark class="app-search-match">&lt;script&gt;alert(1)&lt;/script&gt;</mark>')
    })

    describe('guides whose title the words cover', () => {
      const PROMOTED = '9b2f4c1a-5d3e-4a6b-8c7d-0e1f2a3b4c5d'

      /** One of several guides titled "CS MA Claim - ...", its own id. */
      function caseTitle (number) {
        return searchApi.titleResult({
          documentId: `00000000-0000-4000-8000-00000000000${number}`,
          documentTitle: `CS MA Claim - Case ${number}`,
          url: `/guides/00000000-0000-4000-8000-00000000000${number}`
        })
      }

      test('promotes the one guide, with what it is for and a way to open it, and lists it with the others whose sections have the words', async () => {
        const promoted = searchApi.titleResult({ sections: [searchApi.sectionResult({ documentId: PROMOTED, anchor: 'introduction', sectionNumber: '1', heading: 'Introduction' })], sectionTotal: 1 })
        nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ results: [promoted, searchApi.documentResult()], titles: [promoted] }))
        nock(GUIDANCE_API_BASE_URL).get(`/guides/${PROMOTED}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: PROMOTED, metadata: { ...guideResponse().metadata, goal: 'Decide a claim over the maximum eligible weight.' } }))

        const { main } = await mainOf('/hub?q=CS+MA+Claim+AB12+maximum+eligible+weight')
        const panel = main.slice(main.indexOf('<section class="app-title-match"'), main.indexOf('</section>'))

        expect(main).toContain('<h2 class="govuk-heading-l govuk-!-margin-bottom-1">2 guides</h2>')
        expect(panel).toContain('aria-labelledby="title-match-heading"')
        expect(panel).toContain('Is this the guide you’re looking for?')
        expect(panel).toContain(`<a class="govuk-link" href="/guides/${PROMOTED}"><mark class="app-search-match">CS MA Claim</mark> - AB12 or OP3 Maximum Eligible Weight</a>`)
        expect(panel).toContain('Decide a claim over the maximum eligible weight.')
        expect(panel).toMatch(new RegExp(`<a class="govuk-button[^"]*" href="/guides/${PROMOTED}" role="button"[^>]*>\\s*Open guide`))
        expect(panel).toMatch(new RegExp(`Words also found in\\s*<a class="govuk-link" href="/guides/${PROMOTED}\\?section=introduction#introduction">1 Introduction</a>`))
        expect(main).toContain('<h3 class="govuk-heading-m app-hub-results__list-heading">Sections that mention ‘CS MA Claim AB12 maximum eligible weight’</h3>')
        expect(main).toMatch(/<h4 class="govuk-heading-m app-search-results__name">\s*<a class="govuk-link" href="\/guides\/7c9e6679-7425-40de-944b-e07fc1f90ae7">Countryside Stewardship final payments<\/a>/)
        expect(main).toMatch(new RegExp(`<h4 class="govuk-heading-m app-search-results__name">\\s*<a class="govuk-link" href="/guides/${PROMOTED}">`))
        expect(main).not.toContain('govuk-tag')
      })

      test('promotes the guide without what it is for when it can\'t be read, saying no sections mention the words', async () => {
        nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ results: [], total: 0, titles: [searchApi.titleResult()] }))
        nock(GUIDANCE_API_BASE_URL).get(`/guides/${PROMOTED}`).reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)

        const { statusCode, main } = await mainOf('/hub?q=CS+MA+Claim+AB12+maximum+eligible+weight')

        expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
        expect(main).toContain('Is this the guide you’re looking for?')
        expect(main).toContain('No sections with these words')
        expect(main).toContain('<h3 class="govuk-heading-m app-hub-results__list-heading">Sections that mention ‘CS MA Claim AB12 maximum eligible weight’</h3>')
        expect(main).toContain('<p class="govuk-body app-hub-results__list-empty">No sections mention ‘CS MA Claim AB12 maximum eligible weight’.</p>')
        expect(main).not.toContain('There are no guides with')
        expect(main).not.toContain('Words also found in')
      })

      test('lists several above the sections that have the words, the first five with a link to every one', async () => {
        const titles = [1, 2, 3, 4, 5, 6].map(caseTitle)
        const alsoInSections = { ...titles[0], sections: [searchApi.sectionResult()], sectionTotal: 2 }
        nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ titles: [alsoInSections, ...titles.slice(1)], results: [alsoInSections, searchApi.documentResult()] }))

        const { main } = await mainOf('/hub?q=CS+MA+Claim')
        const list = main.slice(main.indexOf('<section class="app-title-match"'), main.indexOf('</section>'))

        expect(list).toMatch(/<h3 class="govuk-body app-title-match__lead" id="title-match-heading" tabindex="-1">6 guides have ‘CS MA Claim’ in their title<\/h3>/)
        expect(list).toContain('<a class="govuk-link app-title-match__row-title" href="/guides/00000000-0000-4000-8000-000000000001"><mark class="app-search-match">CS MA Claim</mark> - Case 1</a>')
        expect(list).toContain('2 sections')
        expect(list.match(/app-title-match__row"/g)).toHaveLength(5)
        expect(list).toContain('<a class="govuk-link" href="/hub?q=CS+MA+Claim&amp;titles=all#title-match-heading">Show all 6 guides<span class="govuk-visually-hidden"> with ‘CS MA Claim’ in their title</span></a>')
        expect(list).not.toContain('govuk-details')
        expect(main).not.toContain('Is this the guide you’re looking for?')
        expect(main).toContain('Sections that mention ‘CS MA Claim’</h3>')
        expect(main).toMatch(/<h4 class="govuk-heading-m app-search-results__name">\s*<a class="govuk-link" href="\/guides\/00000000-0000-4000-8000-000000000001"><mark class="app-search-match">CS MA Claim<\/mark> - Case 1<\/a>/)
      })

      test('lists several, saying under the heading over sections that none mention the words when only titles have them', async () => {
        nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ titles: [caseTitle(1), caseTitle(2)], results: [], total: 0 }))

        const { main } = await mainOf('/hub?q=CS+MA+Claim')

        expect(main).toContain('No sections with these words')
        expect(main).toContain('Sections that mention ‘CS MA Claim’</h3>')
        expect(main).toContain('<p class="govuk-body app-hub-results__list-empty">No sections mention ‘CS MA Claim’.</p>')
      })

      test('lists every one, with no link to show all, when the address asks for every one', async () => {
        const titles = [1, 2, 3, 4, 5, 6].map(caseTitle)
        nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ titles, results: [] }))

        const { main } = await mainOf('/hub?q=CS+MA+Claim&titles=all')
        const list = main.slice(main.indexOf('<section class="app-title-match"'), main.indexOf('</section>'))

        expect(list.match(/app-title-match__row"/g)).toHaveLength(6)
        expect(list).not.toContain('Show all')
      })

      test('shows no title block, as before, when the words cover no title', async () => {
        nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse())

        const { main } = await mainOf('/hub?q=weight')

        expect(main).not.toContain('app-title-match')
        expect(main).not.toContain('app-hub-results__list-heading')
        expect(main).toMatch(/<h3 class="govuk-heading-m app-search-results__name">/)
      })

      test('shows no title block past the first page', async () => {
        nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ total: 25, titles: [searchApi.titleResult()] }))

        const { main } = await mainOf('/hub?q=CS+MA+Claim&page=2')

        expect(main).not.toContain('app-title-match')
      })

      test('escapes the titles the search service sends', async () => {
        const title = searchApi.titleResult({ documentTitle: '<b>bold</b>', titleMatch: { snippet: [{ text: '<script>x</script>', match: true }] } })
        nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ titles: [title, caseTitle(2)] }))

        const { main } = await mainOf('/hub?q=CS+MA+Claim')

        expect(main).not.toContain('<script>x')
        expect(main).not.toContain('<b>bold')
        expect(main).toContain('<mark class="app-search-match">&lt;script&gt;x&lt;/script&gt;</mark>')
      })
    })

    test('says when nothing has the words, with what to try next', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ results: [], total: 0 }))

      const { main } = await mainOf('/hub?q=zebra')

      expect(main).toContain('0 guides')
      expect(main).toContain('<h3 class="govuk-heading-m">There are no guides with ‘zebra’</h3>')
      expect(main).toContain('You could:')
      expect(main).toMatch(/<ul class="govuk-list govuk-list--bullet">\s*<li>check the spelling<\/li>\s*<li>use fewer or different words<\/li>\s*<li>search for a scheme or case type, for example ‘CS MA Claim’<\/li>\s*<li><a class="govuk-link" href="\/hub">browse all guides<\/a><\/li>\s*<\/ul>/)
      expect(main).not.toContain('sections with these words')
      expect(main).not.toContain('app-title-match')
      expect(main).not.toContain('govuk-pagination')
    })

    test('escapes the words in what it says when nothing has them', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ results: [], total: 0 }))

      const { main } = await mainOf('/hub?q=%3Cscript%3Ex%3C%2Fscript%3E')

      expect(main).not.toContain('<script>x')
      expect(main).toContain('There are no guides with ‘&lt;script&gt;x&lt;/script&gt;’')
    })

    test('says when there are too many matches to show', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.tooManyDocumentsResponse(1500))

      const { main } = await mainOf('/hub?q=the')

      expect(main).toContain('Too many matches. Use more specific words.')
      expect(main).not.toContain('govuk-pagination')
    })

    test('pages between the guides, keeping the words', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse({ total: 25 }))

      const { main } = await mainOf('/hub?q=claim+rules&page=2')

      expect(main).toContain('govuk-pagination')
      expect(main).toContain('href="/hub?q=claim+rules"')
      expect(main).toContain('href="/hub?q=claim+rules&amp;page=3"')
      expect(main).toMatch(/aria-current="page"/)
    })

    test.each([
      ['fails', (scope) => scope.reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)],
      ['can\'t be reached', (scope) => scope.replyWithError('connect ECONNREFUSED')]
    ])('lists every guide, with the filters keeping the words, saying search is not available, when the search service %s', async (_, respond) => {
      respond(nock(SEARCH_API_BASE_URL).get('/v1/search').query(true))

      const { statusCode, main } = await mainOf('/hub?q=claim+rules')

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(main).toContain('govuk-error-summary')
      expect(main).toContain('There is a problem')
      expect(main).toMatch(/<a href="#hub-search">\s*Search is not available at the moment. Try again later, or find a guide in the list below.\s*<\/a>/)
      expect(main).toContain('<h2 class="govuk-heading-l govuk-!-margin-bottom-1">1 guide</h2>')
      expect(main).toContain('<input type="hidden" name="q" value="claim rules">')
    })

    test('says there is an error in the page title when search is not available', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR)
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub?q=claim', headers: { cookie } })

      expect(payload).toMatch(/<title>\s*Error: RPA Guidance Hub/)
    })

    test('does not say there is an error when search answers', async () => {
      nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse())
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub?q=claim', headers: { cookie } })

      expect(payload).not.toContain('govuk-error-summary')
      expect(payload).toMatch(/<title>\s*RPA Guidance Hub/)
    })

    test('lists every guide, saying the words must be shorter, rather than searching for more than the search service takes', async () => {
      const search = nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.documentSearchResponse())
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({ method: 'GET', url: `/hub?q=${'a'.repeat(501)}`, headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(search.isDone()).toBe(false)
      expect(payload).toMatch(/<title>\s*Error: RPA Guidance Hub/)
      expect(payload).toMatch(/<a href="#hub-search">\s*Search must be 500 characters or fewer\s*<\/a>/)
      expect(payload).not.toContain('Search is not available')
      expect(payload).toContain('id="guide-results"')
    })

    test('does not search without words', async () => {
      const search = nock(SEARCH_API_BASE_URL).get('/v1/search').query(true).reply(statusCodes.HTTP_STATUS_OK, searchApi.searchResponse())

      const { main } = await mainOf('/hub?q=+')

      expect(search.isDone()).toBe(false)
      expect(main).not.toContain('govuk-error-summary')
      expect(main).toContain('id="hub-filters"')
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

      return { statusCode, listing, page: pageOf(payload) }
    }

    test('offer the guides specific to no scheme as a scheme of their own, chosen by no_scheme', async () => {
      const withNone = { ...COUNTS, scheme: [...COUNTS.scheme, { label: null, shortLabel: null, count: 2 }] }

      const { listing, page } = await hubWith({ no_scheme: 'true' }, guidePageResponse({ counts: withNone }))
      const scheme = within(filtersOf(page).getByRole('group', { name: 'Scheme' }))
      const notSchemeSpecific = scheme.getByRole('checkbox', { name: 'Not scheme-specific (2)' })

      expect(listing.isDone()).toBe(true)
      expect(notSchemeSpecific).toBeChecked()
      expect(notSchemeSpecific).toHaveAttribute('name', 'no_scheme')
      expect(notSchemeSpecific).toHaveAttribute('value', 'true')
    })

    test('offer who it\'s for, the system used and the scheme year beside the guides, each value with its count', async () => {
      const { page } = await hubWith({})
      const filters = filtersOf(page)
      const year = within(filters.getByRole('group', { name: 'Scheme year' })).getByRole('checkbox', { name: '2026 (1)' })
      const apply = filters.getByRole('button', { name: 'Apply filters' })

      expect(filters.getByRole('heading', { name: 'Filter results' })).toBeInTheDocument()
      expect(within(filters.getByRole('group', { name: 'Who it\'s for' })).getByRole('checkbox', { name: 'Processor (3)' })).toBeInTheDocument()
      expect(filters.getByRole('group', { name: 'System used' })).toBeInTheDocument()
      expect(year).toHaveAttribute('name', 'year')
      expect(year).toHaveAttribute('value', '2026')
      expect(year).toBeChecked()
      expect(year).toBeDisabled()
      expect(filters.queryByRole('group', { name: 'Scheme' })).not.toBeInTheDocument()
      expect(apply.form).toHaveAttribute('action', '/hub#guide-results')
    })

    test('pass the chosen values to the API, check them, and show each as a tag that takes it away', async () => {
      const { listing, page } = await hubWith({ audience: 'Checker', system: 'CRM' })
      const filters = filtersOf(page)

      expect(listing.isDone()).toBe(true)
      expect(filters.getByRole('checkbox', { name: 'Checker (1)' })).toBeChecked()
      expect(filters.getByRole('link', { name: 'Remove filter Checker' })).toHaveAttribute('href', '/hub?system=CRM')
      expect(filters.getByRole('link', { name: 'Remove filter CRM' })).toHaveAttribute('href', '/hub?audience=Checker')
      expect(filters.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/hub')
    })

    test('sort the list as chosen, with Most relevant offered only once search exists', async () => {
      const { listing, page } = await hubWith({ sort: 'updated-oldest' })
      const sort = page.getByRole('combobox', { name: 'Sort by:' })

      expect(listing.isDone()).toBe(true)
      expect(sort).toHaveAttribute('name', 'sort')
      expect(sort.form).toBe(filtersOf(page).getByRole('button', { name: 'Apply filters' }).form)
      expect(sort).toHaveAttribute('data-sort-select', 'true')
      expect(sort).toHaveDisplayValue('Oldest updated')
      expect(within(sort).getByRole('option', { name: 'Most relevant' })).toBeDisabled()
      expect(page.getByText('(Most relevant once you search)')).toBeInTheDocument()
    })

    test('show a value the hub no longer has as a box that cannot be ticked, as choosing it would be refused', async () => {
      const retired = { ...COUNTS, system: [...COUNTS.system, { label: 'Old system', shortLabel: null, count: 2, retired: true }] }

      const { page } = await hubWith({}, guidePageResponse({ counts: retired }))
      const filters = filtersOf(page)

      expect(filters.getByRole('checkbox', { name: 'Old system (2)' })).toBeDisabled()
      expect(filters.getByRole('checkbox', { name: 'CRM (3)' })).toBeEnabled()
    })

    test('say that no guides match when the chosen values leave none', async () => {
      const { page } = await hubWith({ system: 'CRM' }, guidePageResponse({ items: [], counts: COUNTS }))

      expect(page.getByText(HUB_MESSAGES.noneMatch)).toBeInTheDocument()
      expect(page.queryByText(HUB_MESSAGES.noGuides)).not.toBeInTheDocument()
    })

    test('answer a value the hub does not have as a bad request', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(422, refusalResponse({ detail: 'Unknown audience Martians' }))
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({ method: 'GET', url: '/hub?audience=Martians', headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('carry on to the side navigation\'s links to the hub and its lists', async () => {
      const { page } = await hubWith({ system: 'CRM' })
      const sideNav = sideNavOf(page)

      expect(sideNav.getByRole('link', { name: 'Recently opened' })).toHaveAttribute('href', '/hub/recently-opened?system=CRM')
      expect(sideNav.getByRole('link', { name: /^Pinned/ })).toHaveAttribute('href', '/hub/pinned?system=CRM')
      expect(sideNav.getByRole('link', { name: 'Hub' })).toHaveAttribute('href', '/hub?system=CRM')
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
      const [first, second] = rowsOf(pageOf(payload))

      expect(first.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${PINNED}`)
      expect(first.getByText('Pinned')).toBeInTheDocument()
      expect(starFormOf(first, { pressed: true })).toHaveFormValues({ pin: 'false', position: '0', anchor: `pin-${PINNED}` })
      expect(second.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${OTHER}`)
      expect(second.queryByText('Pinned')).not.toBeInTheDocument()
      expect(starFormOf(second, { pressed: false })).toHaveFormValues({ pin: 'true', returnTo: '/hub?system=CRM' })
      expect(second.getByRole('button', { name: /^Pin / })).toHaveAttribute('id', `pin-${OTHER}`)
    })

    test('count a guide as pinned only when it is pinned whole, at its own place among the pins', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({
        items: [guideSummaryResponse({ id: OTHER }), guideSummaryResponse({ id: PINNED })]
      }))
      const section = { sectionId: '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d99', section: '1-pay', heading: '1 Pay' }
      const cookie = await signedIn({ pinned: [pinResponse({ id: OTHER, ...section }), pinResponse({ id: PINNED }), pinResponse({ id: PINNED, ...section })] })

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })
      const [first, second] = rowsOf(pageOf(payload))
      const firstStar = starFormOf(first)
      const secondStar = starFormOf(second)

      expect(first.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${PINNED}`)
      expect(firstStar).toHaveFormValues({ position: '1' })
      expect(firstStar).toHaveAttribute('data-reorder-follows', PINNED)
      expect(second.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${OTHER}`)
      expect(secondStar).toHaveFormValues({ pin: 'true' })
      expect(secondStar).not.toHaveAttribute('data-reorder-follows')
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
      const page = pageOf(payload)
      const [row] = rowsOf(page)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.getByRole('heading', { level: 2, name: '1 pin' })).toBeInTheDocument()
      expect(row.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${PINNED}`)
      expect(row.getByText('Pinned')).toBeInTheDocument()
      expect(starFormOf(row)).toHaveFormValues({ position: '1' })
      expect(filtersOf(page).getByRole('button', { name: 'Apply filters' }).form).toHaveAttribute('action', '/hub/pinned#guide-results')
      expect(page.queryByRole('combobox', { name: 'Sort by:' })).not.toBeInTheDocument()
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
      const page = pageOf(payload)
      const [section, guide] = rowsOf(page)
      const sectionStar = section.getByRole('button', { name: 'Pin 1 Pay, in Claiming the SFI payment' })
      const guideStar = guide.getByRole('button', { name: 'Pin Claiming the SFI payment' })

      expect(page.getByRole('heading', { level: 2, name: '2 pins' })).toBeInTheDocument()
      expect(section.getByRole('link', { name: '1 Pay, in Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${PINNED}?section=1-pay#1-pay`)
      expect(section.getByText('In Claiming the SFI payment')).toBeInTheDocument()
      expect(sectionStar.form).toHaveAttribute('data-reorder-follows', `${PINNED}/${SECTION}`)
      expect(sectionStar.form).toHaveFormValues({ position: '0', sectionId: SECTION, anchor: 'guide-results' })
      expect(sectionStar).toHaveAttribute('id', `pin-${SECTION}`)
      expect(guide.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${PINNED}`)
      expect(guideStar.form).toHaveFormValues({ position: '1', anchor: 'guide-results' })
      expect(guideStar.form.elements.namedItem('sectionId')).toBeNull()
      expect(guideStar).toHaveAttribute('id', `pin-${PINNED}`)
      expect(page.document.getElementById('guide-results')).toContainElement(sectionStar)
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
      const page = pageOf(payload)
      const filters = filtersOf(page)
      const year = filters.getByRole('checkbox', { name: '2026 (1)' })

      expect(page.getByRole('heading', { level: 2, name: '2 pins' })).toBeInTheDocument()
      expect(filters.getByRole('checkbox', { name: 'Processor (1)' })).toBeInTheDocument()
      expect(year).toBeChecked()
      expect(year).toBeDisabled()
    })

    test('say on their own page when nothing is pinned yet', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/pins`).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/pinned', headers: { cookie } })
      const page = pageOf(payload)

      expect(page.getByText('Pin guide').closest('p')).toHaveTextContent(textOf(HUB_MESSAGES.nonePinned))
      expect(page.getByText('Pin guide').tagName).toBe('STRONG')
    })

    test('say on their own page when nothing is pinned yet, even with filters chosen', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/pins`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({ items: [] }))
        .get(`/users/${USER_ID}/pins`).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/pinned?system=CRM', headers: { cookie } })
      const page = pageOf(payload)

      expect(page.getByText('Pin guide').closest('p')).toHaveTextContent(textOf(HUB_MESSAGES.nonePinned))
      expect(page.queryByText(HUB_MESSAGES.noneMatch)).not.toBeInTheDocument()
    })

    test('say when the chosen filters leave none of them', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/pins`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse({ items: [] }))
        .get(`/users/${USER_ID}/pins`).reply(statusCodes.HTTP_STATUS_OK, pinnedGuidesResponse())

      const { payload } = await server.inject({ method: 'GET', url: '/hub/pinned?system=CRM', headers: { cookie } })
      const page = pageOf(payload)

      expect(page.getByText(HUB_MESSAGES.noneMatch)).toBeInTheDocument()
      expect(page.document.querySelector('main')).not.toHaveTextContent(textOf(HUB_MESSAGES.nonePinned))
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
      const page = pageOf(payload)
      const [newer, older] = rowsOf(page)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.getByRole('heading', { level: 2, name: '2 recently opened guides' })).toBeInTheDocument()
      expect(newer.getByRole('link', { name: 'Closing a case' })).toHaveAttribute('href', `/guides/${NEWER}`)
      expect(starFormOf(newer)).toHaveFormValues({ pin: 'true' })
      expect(older.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${OLDER}`)
      expect(older.getByText('Pinned')).toBeInTheDocument()
      expect(starFormOf(older)).toHaveFormValues({ position: '0' })
      expect(filtersOf(page).getByRole('button', { name: 'Apply filters' }).form).toHaveAttribute('action', '/hub/recently-opened#guide-results')
      expect(page.queryByRole('combobox', { name: 'Sort by:' })).not.toBeInTheDocument()
    })

    test('say on their own page when none has been opened yet', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/recently-opened', headers: { cookie } })

      expect(pageOf(payload).getByText(HUB_MESSAGES.noneOpened)).toBeInTheDocument()
    })

    test('say on their own page when none has been opened yet, even with filters chosen', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/recently-opened`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({ items: [] }))
        .get(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/recently-opened?system=CRM', headers: { cookie } })
      const page = pageOf(payload)

      expect(page.getByText(HUB_MESSAGES.noneOpened)).toBeInTheDocument()
      expect(page.queryByText(HUB_MESSAGES.noneMatch)).not.toBeInTheDocument()
    })

    test('say when the chosen filters leave none of them', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/recently-opened`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse({ items: [] }))
        .get(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_OK, recentlyOpenedResponse())

      const { payload } = await server.inject({ method: 'GET', url: '/hub/recently-opened?system=CRM', headers: { cookie } })
      const page = pageOf(payload)

      expect(page.getByText(HUB_MESSAGES.noneMatch)).toBeInTheDocument()
      expect(page.queryByText(HUB_MESSAGES.noneOpened)).not.toBeInTheDocument()
    })
  })

  describe('bookmarked guides', () => {
    const { id: USER_ID } = userResponse()
    const CLOSING = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
    const CLAIMS = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

    async function signedIn (user) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse(user))

      return loginAsDevUser(server)
    }

    test('list on their own page in the API\'s order, as the hub\'s rows, beside the filters, without a sort', async () => {
      nock.cleanAll()
      const cookie = await signedIn({ pinned: [pinResponse({ id: CLAIMS, title: 'Claiming the SFI payment' })] })
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/bookmarked-guides`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse({
        items: [
          guideSummaryResponse({ id: CLOSING, latestVersion: versionResponse({ title: 'Closing a case' }) }),
          guideSummaryResponse({ id: CLAIMS })
        ],
        counts: { audience: [], system: [{ label: 'CRM', shortLabel: null, count: 2, retired: false }], scheme: [] }
      }))

      const { statusCode, payload } = await server.inject({ method: 'GET', url: '/hub/bookmarked-guides?system=CRM', headers: { cookie } })
      const page = pageOf(payload)
      const [closing, claims] = rowsOf(page)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.getByRole('heading', { level: 2, name: '2 bookmarked guides' })).toBeInTheDocument()
      expect(closing.getByRole('link', { name: 'Closing a case' })).toHaveAttribute('href', `/guides/${CLOSING}`)
      expect(claims.getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${CLAIMS}`)
      expect(starFormOf(claims)).toHaveFormValues({ position: '0' })
      expect(filtersOf(page).getByRole('checkbox', { name: 'CRM (2)' })).toBeChecked()
      expect(filtersOf(page).getByRole('button', { name: 'Apply filters' }).form).toHaveAttribute('action', '/hub/bookmarked-guides#guide-results')
      expect(page.queryByRole('combobox', { name: 'Sort by:' })).not.toBeInTheDocument()
    })

    test('say on their own page when none is bookmarked yet', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/bookmarked-guides`).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse({ items: [] }))

      const { payload } = await server.inject({ method: 'GET', url: '/hub/bookmarked-guides', headers: { cookie } })

      expect(pageOf(payload).getByText(HUB_MESSAGES.noneBookmarked)).toBeInTheDocument()
    })

    test('say when the chosen filters leave none of them', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL)
        .get(`/users/${USER_ID}/bookmarked-guides`).query({ system: 'CRM' }).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse({ items: [] }))
        .get(`/users/${USER_ID}/bookmarked-guides`).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse())

      const { payload } = await server.inject({ method: 'GET', url: '/hub/bookmarked-guides?system=CRM', headers: { cookie } })
      const page = pageOf(payload)

      expect(page.getByText(HUB_MESSAGES.noneMatch)).toBeInTheDocument()
      expect(page.queryByText(HUB_MESSAGES.noneBookmarked)).not.toBeInTheDocument()
    })

    describe('narrowed to one case', () => {
      const KEY = caseResponse().key
      const NARROWED = `/hub/bookmarked-guides?case=${KEY}`
      const CRM_COUNTS = { audience: [], system: [{ label: 'CRM', shortLabel: null, count: 1, retired: false }], scheme: [] }

      /** The page at `url`, for a user with case W1234567, the API answering the case's guides for `query`. */
      async function narrowedPage (url, query = { case: KEY }) {
        nock.cleanAll()
        const cookie = await signedIn({ cases: [caseResponse()] })
        const listing = nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/bookmarked-guides`).query(query).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse({
          items: [guideSummaryResponse({ id: CLAIMS })],
          counts: CRM_COUNTS
        }))

        const { statusCode, payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

        return { statusCode, listing, page: pageOf(payload) }
      }

      test('list the guides of the case alone, by its key, showing it as a selected filter that takes it away', async () => {
        const { statusCode, listing, page } = await narrowedPage(NARROWED)

        expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
        expect(listing.isDone()).toBe(true)
        expect(rowsOf(page)[0].getByRole('link', { name: 'Claiming the SFI payment' })).toHaveAttribute('href', `/guides/${CLAIMS}`)
        expect(filtersOf(page).getByRole('link', { name: 'Remove filter Case: W1234567' })).toHaveAttribute('href', '/hub/bookmarked-guides')
      })

      test('name the case in the heading of the results, as well as in the filters', async () => {
        const { page } = await narrowedPage(NARROWED)

        expect(page.getByRole('heading', { name: '1 bookmarked guide for Case: W1234567' })).toBeInTheDocument()
      })

      test('keep the case as the other filters change, until they are cleared', async () => {
        const { page } = await narrowedPage(`${NARROWED}&system=CRM`, { case: KEY, system: 'CRM' })
        const filters = filtersOf(page)

        expect(filters.getByRole('button', { name: 'Apply filters' }).form).toHaveFormValues({ case: KEY })
        expect(filters.getByRole('checkbox', { name: 'CRM (1)' })).toBeChecked()
        expect(filters.getByRole('link', { name: 'Remove filter CRM' })).toHaveAttribute('href', NARROWED)
        expect(filters.getByRole('link', { name: 'Remove filter Case: W1234567' })).toHaveAttribute('href', '/hub/bookmarked-guides?system=CRM')
        expect(filters.getByRole('link', { name: 'Clear filters' })).toHaveAttribute('href', '/hub/bookmarked-guides')
      })

      test('name the case neither in the address nor in the page title', async () => {
        const { page } = await narrowedPage(NARROWED)

        expect(page.document.title).not.toMatch(/W1234567|case|sbi/i)
      })

      test('mark the case as the current page in the side navigation, and "Bookmarked" only as the list it belongs to', async () => {
        const { page } = await narrowedPage(NARROWED)
        const nav = sideNavOf(page)

        expect(nav.getByRole('link', { name: /W1234567/, current: 'page' })).toHaveAttribute('href', NARROWED)
        expect(nav.getByRole('link', { name: /^Bookmarked\b/ })).toHaveAttribute('aria-current', 'true')
      })

      test('mark "Bookmarked" as the current page when no case is chosen', async () => {
        nock.cleanAll()
        const cookie = await signedIn({ cases: [caseResponse()] })
        nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/bookmarked-guides`).query(true).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse())

        const { payload } = await server.inject({ method: 'GET', url: '/hub/bookmarked-guides', headers: { cookie } })
        const nav = sideNavOf(pageOf(payload))

        expect(nav.getByRole('link', { name: /^Bookmarked\b/, current: 'page' })).toBeInTheDocument()
        expect(nav.getByRole('link', { name: /W1234567/ })).not.toHaveAttribute('aria-current')
      })

      test.each([
        ['a key the user does not have', '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c'],
        ['the case\'s ID', 'W1234567']
      ])('answer %s as page not found, listing nothing', async (_name, named) => {
        const { statusCode, listing, page } = await narrowedPage(`/hub/bookmarked-guides?case=${named}`, true)

        expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
        expect(page.getByText('Page not found')).toBeInTheDocument()
        expect(listing.isDone()).toBe(false)
      })

      test('say the case bookmarks cannot be read, not that the page is not found, when the user\'s record cannot be had', async () => {
        nock.cleanAll()
        nock(GUIDANCE_API_BASE_URL)
          .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
          .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_SERVICE_UNAVAILABLE)
        const cookie = await loginAsDevUser(server)
        const listing = nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/bookmarked-guides`).query(true).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse())

        const { statusCode, payload } = await server.inject({ method: 'GET', url: NARROWED, headers: { cookie } })

        expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_GATEWAY)
        expect(pageOf(payload).getByText(BOOKMARK_MESSAGES.casesUnreadable)).toBeInTheDocument()
        expect(listing.isDone()).toBe(false)
      })

      test('say that no guides match, not that none is bookmarked, when the case lists none but another case does', async () => {
        nock.cleanAll()
        const cookie = await signedIn({ cases: [caseResponse(), caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', ref: 'W7654321' })] })
        nock(GUIDANCE_API_BASE_URL)
          .get(`/users/${USER_ID}/bookmarked-guides`).query({ case: KEY }).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse({ items: [] }))
          .get(`/users/${USER_ID}/bookmarked-guides`).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse())

        const { payload } = await server.inject({ method: 'GET', url: NARROWED, headers: { cookie } })
        const page = pageOf(payload)

        expect(page.getByText(HUB_MESSAGES.noneMatch)).toBeInTheDocument()
        expect(page.queryByText(HUB_MESSAGES.noneBookmarked)).not.toBeInTheDocument()
      })
    })

    test('mark "Bookmarked" as the current page in the side navigation', async () => {
      nock.cleanAll()
      const cookie = await signedIn({})
      nock(GUIDANCE_API_BASE_URL).get(`/users/${USER_ID}/bookmarked-guides`).reply(statusCodes.HTTP_STATUS_OK, bookmarkedGuidesResponse())

      const { payload } = await server.inject({ method: 'GET', url: '/hub/bookmarked-guides', headers: { cookie } })

      expect(sideNavOf(pageOf(payload)).getByRole('link', { name: /^Bookmarked\b/, current: 'page' })).toBeInTheDocument()
    })
  })
})
