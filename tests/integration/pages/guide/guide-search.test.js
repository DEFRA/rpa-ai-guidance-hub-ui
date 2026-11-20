import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guideResponse, guideSearchResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf } from '../../helpers/page.js'
import { keepPreferencesInTheApi } from '../../helpers/preferences-api.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const GUIDE_URL = `/guides/${GUIDE_ID}`
const MARKDOWN = [
  '# Paying claims',
  '## Introduction', 'Pay on time.',
  '## Close case', 'Close it.',
  '### Check payment', 'Pay the claim.',
  '#### Late payment', 'Pay late.',
  '## Archive', 'Keep it.'
].join('\n\n')

// "pay" in three sections: a heading the
// contents do not list ("Late payment") is under the one before it.
const FOUND = guideSearchResponse({
  sections: [
    { anchor: 'introduction', matches: [{ start: 13, end: 16, text: 'Pay' }] },
    { anchor: 'check-payment', matches: [{ start: 6, end: 9, text: 'pay' }, { start: 14, end: 17, text: 'Pay' }] },
    { anchor: 'late-payment', matches: [{ start: 5, end: 8, text: 'pay' }, { start: 13, end: 16, text: 'Pay' }] }
  ]
})

describe('Search in a guide', () => {
  let server, cookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(async () => {
    cookie = await loginAsDevUser(server)
  })

  afterEach(() => {
    nock.cleanAll()
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  /**
   * The guide's page at `query`, the API answering a search for "pay" as
   * `search` says: a status and a body.
   */
  async function guidePage ({ query = '', search, format = 'traditional', markdown = MARKDOWN } = {}) {
    keepPreferencesInTheApi({ guideFormat: format })
    const api = nock(GUIDANCE_API_BASE_URL)
      .get(GUIDE_URL).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID }))
      .get(`${GUIDE_URL}/content`).reply(statusCodes.HTTP_STATUS_OK, markdown, { 'Content-Type': 'text/plain' })

    if (search) {
      api.get(`${GUIDE_URL}/search`).query({ q: 'pay' }).reply(...search)
    }

    const { payload } = await server.inject({ method: 'GET', url: `${GUIDE_URL}${query}`, headers: { cookie } })

    return pageOf(payload)
  }

  const searchBoxOf = page => page.getByRole('searchbox', { name: 'Search this guide' })
  const contentsOf = page => within(page.getByRole('navigation', { name: 'Contents' }))
  const entryOf = (page, title) => contentsOf(page).getByRole('link', { name: title }).parentElement

  test('offers a search of the guide, sending the words in the page\'s address, and says nothing until there are some', async () => {
    const page = await guidePage()
    const box = searchBoxOf(page)

    expect(box).toHaveAttribute('name', 'q')
    expect(box.form).toHaveAttribute('method', 'get')
    expect(box.form).toHaveAttribute('action', GUIDE_URL)
    expect(page.queryByRole('status')).not.toBeInTheDocument()
  })

  test('names its search area, so a screen reader tells it from the hub\'s search in the side navigation', async () => {
    const page = await guidePage()

    expect(page.getByRole('search', { name: 'Search this guide' })).toContainElement(searchBoxOf(page))
  })

  test('has a search box with an ID no heading of the guide can have, so a heading titled "Guide search" keeps its own', async () => {
    const page = await guidePage({ markdown: '# Test guide\n\n## Introduction\n\n### Guide search\n\nText.' })
    const heading = page.getByRole('heading', { name: 'Guide search' })
    const ids = Array.from(page.document.querySelectorAll('[id]'), element => element.id)

    expect(heading).toHaveAttribute('id', 'guide-search')
    expect(new Set(ids).size).toBe(ids.length)
    expect(searchBoxOf(page)).toHaveAttribute('id', 'guide:search')
  })

  test('shows how many matches the guide holds, and in how many of its sections, with the words searched for', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })

    expect(page.getByRole('status')).toHaveTextContent('5 matches in 2 sections')
    expect(searchBoxOf(page)).toHaveValue('pay')
  })

  test('starts the page\'s title with what the search found, as a screen reader reads the title first when the page loads', async () => {
    const searched = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })
    const unsearched = await guidePage()

    expect(searched.document.title).toBe(`5 matches in 2 sections – ${unsearched.document.title}`)
  })

  test('shows how many matches are under each contents entry, and none beside an entry with none', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })

    expect(entryOf(page, 'Introduction')).toHaveTextContent(/^Introduction\s*1 match$/)
    expect(entryOf(page, 'Check payment')).toHaveTextContent(/^Check payment\s*4 matches$/)
    expect(entryOf(page, 'Close case')).toHaveTextContent(/^Close case$/)
    expect(entryOf(page, 'Archive')).toHaveTextContent(/^Archive$/)
  })

  test('says so when the guide does not hold the words', async () => {
    const none = guideSearchResponse({ sections: [] })
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, none] })

    expect(page.getByRole('status')).toHaveTextContent('No matches for pay')
  })

  test('shows the guide as it is, saying search is not available, when the search fails', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, {}] })

    expect(page.getByRole('status')).toHaveTextContent('Search is not available')
    expect(page.getByRole('heading', { name: 'Check payment' })).toBeInTheDocument()
    expect(entryOf(page, 'Introduction')).toHaveTextContent(/^Introduction$/)
  })

  test('shows no counts, saying search is not available, when the search was of another version than the one shown', async () => {
    // A version saved between the page's reads of the guide and of the search.
    const ofAnother = guideSearchResponse({ ...FOUND, versionId: 'version-2' })
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, ofAnother] })

    expect(page.getByRole('status')).toHaveTextContent('Search is not available')
    expect(entryOf(page, 'Check payment')).toHaveTextContent(/^Check payment$/)
  })

  test('offers to clear the search, back to the guide without it', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })

    expect(page.getByRole('link', { name: 'Clear search' })).toHaveAttribute('href', GUIDE_URL)
  })

  test('keeps the reader on their page of the stepper when they search, and when they clear the search', async () => {
    const page = await guidePage({ query: '?section=archive&q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND], format: 'stepper' })
    const sent = Array.from(searchBoxOf(page).form.elements, field => [field.name, field.value]).filter(([name]) => name)

    expect(sent).toEqual([['section', 'archive'], ['q', 'pay']])
    expect(page.getByRole('link', { name: 'Clear search' })).toHaveAttribute('href', `${GUIDE_URL}?section=archive`)
  })

  test('keeps the words in a link from one page of the stepper to another', async () => {
    const markdown = MARKDOWN.replace('Pay on time.', 'Pay on time, or see [the archive](#archive).')
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND], format: 'stepper', markdown })

    expect(page.getByRole('link', { name: 'the archive' })).toHaveAttribute('href', `${GUIDE_URL}?section=archive&q=pay#archive`)
  })

  test('keeps the words in the address of each of the guide\'s pages, in the stepper', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND], format: 'stepper' })

    expect(contentsOf(page).getByRole('link', { name: 'Close case' })).toHaveAttribute('href', `${GUIDE_URL}?section=close-case&q=pay`)
  })

  describe('for the page\'s script, which marks the matches and steps between them', () => {
    // "## Claims" is "claims" to the hub, but "claims-1" on the page, which
    // numbers the title's heading too. The heading in the quote starts no
    // section, so its text is in the one before it.
    const NAMED_TWICE = '# Claims\n\nPay first.\n\n## Claims\n\nPay the claim.\n\n> ### Note\n>\n> Pay late.\n\n### Checks\n\nPay twice.'
    const FOUND_IN_IT = guideSearchResponse({
      sections: [
        { anchor: null, matches: [{ start: 0, end: 3, text: 'Pay' }] },
        { anchor: 'claims', matches: [{ start: 7, end: 10, text: 'Pay' }, { start: 27, end: 30, text: 'Pay' }] },
        { anchor: 'checks', matches: [{ start: 7, end: 10, text: 'Pay' }] }
      ]
    })
    const handedOver = form => ({
      q: form.dataset.guideSearchQ,
      matches: JSON.parse(form.dataset.guideSearchMatches),
      sections: JSON.parse(form.dataset.guideSearchSections)
    })

    test('hands over each match by the id its section\'s heading has on the page, and the headings that start a section', async () => {
      const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND_IN_IT], markdown: NAMED_TWICE })

      expect(handedOver(searchBoxOf(page).form)).toEqual({
        q: 'pay',
        matches: [
          { anchor: '', start: 0, end: 3, text: 'Pay' },
          { anchor: 'claims-1', start: 7, end: 10, text: 'Pay' },
          { anchor: 'claims-1', start: 27, end: 30, text: 'Pay' },
          { anchor: 'checks', start: 7, end: 10, text: 'Pay' }
        ],
        sections: ['claims-1', 'checks']
      })
    })

    test('says which section each page holds, none for an Introduction', async () => {
      const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND_IN_IT], markdown: NAMED_TWICE })
      const pages = Array.from(page.document.querySelectorAll('[data-guide-page]'))

      expect(pages.map(each => each.dataset.guidePageSection)).toEqual(['', 'claims-1'])
    })

    test('offers Previous and Next match, and where the reader is among the matches, hidden until the script shows them', async () => {
      const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })
      const controls = page.document.querySelector('[data-guide-search-controls]')

      expect(controls).toHaveAttribute('hidden')
      // As the page's script shows them.
      controls.removeAttribute('hidden')

      const previous = within(controls).getByRole('button', { name: 'Previous match' })
      const next = within(controls).getByRole('button', { name: 'Next match' })

      expect([previous, next].map(button => button.getAttribute('type'))).toEqual(['button', 'button'])
      expect([previous, next].map(button => button.getAttribute('aria-keyshortcuts'))).toEqual(['Shift+Enter', 'Enter'])
      expect(controls.querySelector('[aria-live="polite"]')).toBeInTheDocument()
    })

    test('gives each contents count the number of the first match under it, for the script to go to', async () => {
      const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })
      const firstOf = title => entryOf(page, title).querySelector('.app-guide-contents__count').dataset.guideSearchFirst

      expect([firstOf('Introduction'), firstOf('Check payment')]).toEqual(['1', '2'])
    })

    test('hands over nothing, and offers no stepping, when nothing matches', async () => {
      const none = guideSearchResponse({ title: [], sections: [] })
      const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, none] })

      expect(searchBoxOf(page).form.dataset.guideSearchMatches).toBeUndefined()
      expect(page.queryByRole('button', { name: /Next match/, hidden: true })).not.toBeInTheDocument()
    })
  })
})
