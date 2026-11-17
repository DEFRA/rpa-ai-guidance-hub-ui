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

// "pay" in the guide's title once, and in three sections: a heading the
// contents do not list ("Late payment") is under the one before it.
const FOUND = guideSearchResponse({
  title: [{ start: 0, end: 3, text: 'Pay' }],
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
  async function guidePage ({ query = '', search, format = 'traditional' } = {}) {
    keepPreferencesInTheApi({ guideFormat: format })
    const api = nock(GUIDANCE_API_BASE_URL)
      .get(GUIDE_URL).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID }))
      .get(`${GUIDE_URL}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })

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

  test('shows how many matches the guide holds, and in how many of its sections, with the words searched for', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })

    expect(page.getByRole('status')).toHaveTextContent('6 matches in 2 sections')
    expect(searchBoxOf(page)).toHaveValue('pay')
  })

  test('shows how many matches are under each contents entry, and none beside an entry with none', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })

    expect(entryOf(page, 'Introduction')).toHaveTextContent(/^Introduction\s*1 match$/)
    expect(entryOf(page, 'Check payment')).toHaveTextContent(/^Check payment\s*4 matches$/)
    expect(entryOf(page, 'Close case')).toHaveTextContent(/^Close case$/)
    expect(entryOf(page, 'Archive')).toHaveTextContent(/^Archive$/)
  })

  test('says so when the guide does not hold the words', async () => {
    const none = guideSearchResponse({ title: [], sections: [] })
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, none] })

    expect(page.getByRole('status')).toHaveTextContent('No matches for pay')
  })

  test('shows the guide as it is, saying search is not available, when the search fails', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_INTERNAL_SERVER_ERROR, {}] })

    expect(page.getByRole('status')).toHaveTextContent('Search is not available')
    expect(page.getByRole('heading', { name: 'Check payment' })).toBeInTheDocument()
    expect(entryOf(page, 'Introduction')).toHaveTextContent(/^Introduction$/)
  })

  test('offers to clear the search, back to the guide without it', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND] })

    expect(page.getByRole('link', { name: 'Clear search' })).toHaveAttribute('href', GUIDE_URL)
  })

  test('keeps the words in the address of each of the guide\'s pages, in the stepper', async () => {
    const page = await guidePage({ query: '?q=pay', search: [statusCodes.HTTP_STATUS_OK, FOUND], format: 'stepper' })

    expect(contentsOf(page).getByRole('link', { name: 'Close case' })).toHaveAttribute('href', `${GUIDE_URL}?section=close-case&q=pay`)
  })
})
