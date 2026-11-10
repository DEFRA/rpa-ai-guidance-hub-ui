import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../../src/config/config.js'
import { createServer } from '../../../../../src/server/server.js'
import { caseResponse, guideResponse, refusalResponse, userResponse } from '../../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../helpers/login.js'
import { errorSummaryOf, pageOf } from '../../../helpers/page.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const OTHER_GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
const { id: USER_ID } = userResponse()
const GUIDE_PAGE = `/guides/${GUIDE_ID}`
const BOOKMARK_PAGE = `${GUIDE_PAGE}/bookmark`

// Its sections are "1 Introduction" at `1-introduction`, with "1.1 Before you
// begin" at `11-before-you-begin` inside it, and "2 Assign case" at
// `2-assign-case`, on the second page.
const MARKDOWN = [
  '# Claiming the SFI payment',
  '',
  '## 1 Introduction',
  '',
  'Start here.',
  '',
  '### 1.1 Before you begin',
  '',
  'Check.',
  '',
  '## 2 Assign case',
  '',
  'Assign it.'
].join('\n')

const SECTION = { sectionId: '019a0000-0000-7000-8000-000000000011', section: '11-before-you-begin', heading: '1.1 Before you begin', position: 0 }

function mockGuideAndUser (cases = [], markdown = MARKDOWN) {
  nock(GUIDANCE_API_BASE_URL)
    .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID, title: 'Claiming the SFI payment' }))
    .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, markdown, { 'Content-Type': 'text/plain' })
    .post('/users').optionally().reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
    .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ cases }))
}

/**
 * The controls after a heading on a guide's page, in their order: its star,
 * which pins the section, then its bookmark, which bookmarks it to a case.
 * Sections not being read are hidden until find-in-page finds them, so their
 * controls are found hidden as well.
 */
function controlsAfter (heading) {
  const row = within(heading.closest('.app-guide-heading-row'))

  return {
    all: [...heading.closest('.app-guide-heading-row').querySelectorAll('button, a')],
    star: row.getByRole('button', { name: /^(Pin|Unpin) section/, hidden: true }),
    bookmark: row.getByRole('link', { name: /^Bookmark/, hidden: true })
  }
}

describe('bookmarking a section of a guide to a case', () => {
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
    config.set('featureFlags.sbiBookmarks', false)
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server?.stop({ timeout: 0 })
  })

  function get (url) {
    return server.inject({ method: 'GET', url, headers: { cookie } })
  }

  function post (payload) {
    return server.inject({ method: 'POST', url: BOOKMARK_PAGE, headers: { cookie }, payload })
  }

  /** Each of the question's choices, by its value, and whether it can be chosen. */
  function choicesOf (page) {
    return page.getAllByRole('radio').map((radio) => [radio.value, radio.disabled])
  }

  /** The form that asks the question, found by its button. */
  function formOf (page) {
    return page.getByRole('button', { name: 'Bookmark section' }).form
  }

  describe('the question', () => {
    test('asks about the section the address names, with its heading', async () => {
      mockGuideAndUser()

      const { statusCode, payload } = await get(`${BOOKMARK_PAGE}?section=11-before-you-begin`)

      const page = pageOf(payload)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(page.getByRole('heading', { level: 1, name: 'Bookmark this section to a case' })).toBeInTheDocument()
      expect(page.getByText('‘1.1 Before you begin’ in Claiming the SFI payment will show under that case in the side navigation.')).toBeInTheDocument()
      expect(formOf(page)).toHaveFormValues({ section: '11-before-you-begin' })
    })

    test('goes back, or cancels, to the guide at the section, changing nothing', async () => {
      mockGuideAndUser()

      const { payload } = await get(`${BOOKMARK_PAGE}?section=2-assign-case`)

      const page = pageOf(payload)
      expect(within(page.document.body).getByRole('link', { name: 'Back' })).toHaveAttribute('href', `${GUIDE_PAGE}?page=2#2-assign-case`)
      expect(page.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', `${GUIDE_PAGE}?page=2#2-assign-case`)
    })

    test.each([
      ['no section', BOOKMARK_PAGE],
      ['a section the guide has not', `${BOOKMARK_PAGE}?section=9-never`]
    ])('is not there for %s', async (_case, url) => {
      mockGuideAndUser()

      const { statusCode } = await get(url)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })

    test('offers one choice of four, the SBI ones off until switched on, and existing ones only when there are some', async () => {
      mockGuideAndUser()

      const { payload } = await get(`${BOOKMARK_PAGE}?section=11-before-you-begin`)

      const page = pageOf(payload)
      expect(choicesOf(page)).toEqual([
        ['existing-case', true],
        ['new-case', false],
        ['existing-sbi', true],
        ['new-sbi', true]
      ])
      expect(page.getByLabelText('Case ID')).toHaveAccessibleDescription('A letter followed by 7 numbers, for example W1234567')
    })

    test('offers the cases there are, and the SBI choices when switched on', async () => {
      config.set('featureFlags.sbiBookmarks', true)
      mockGuideAndUser([caseResponse(), caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', type: 'sbi', ref: '123456789' })])

      const { payload } = await get(`${BOOKMARK_PAGE}?section=11-before-you-begin`)

      const page = pageOf(payload)
      expect(choicesOf(page)).toEqual([
        ['existing-case', false],
        ['new-case', false],
        ['existing-sbi', false],
        ['new-sbi', false]
      ])
      expect(page.getByRole('option', { name: 'W1234567' })).toHaveAttribute('value', 'W1234567')
      expect(page.getByRole('option', { name: '123456789' })).toHaveAttribute('value', '123456789')
    })

    test('sends the cases it offered, in their order, so that saving can tell whether they changed', async () => {
      const second = caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', ref: 'W7654321' })
      mockGuideAndUser([caseResponse(), second])

      const { payload } = await get(`${BOOKMARK_PAGE}?section=11-before-you-begin`)

      expect(formOf(pageOf(payload))).toSendInOrder('shown', [caseResponse().key, second.key])
    })
  })

  describe('the answer', () => {
    test.each([
      [{}, 'Select if you are bookmarking to an existing or new case ID or SBI application number'],
      [{ choice: 'new-case', newCase: '' }, 'Enter a case ID'],
      [{ choice: 'new-case', newCase: 'W12345' }, 'Case ID must be a letter followed by 7 numbers'],
      [{ choice: 'new-sbi', newSbi: '123456789' }, 'Select if you are bookmarking to an existing or new case ID or SBI application number'],
      [{ choice: 'existing-case', existingCase: 'W7654321' }, 'Select an existing case ID']
    ])('is checked: %j says "%s"', async (answer, message) => {
      mockGuideAndUser([caseResponse()])

      const { statusCode, payload } = await post({ section: '11-before-you-begin', ...answer })

      const errors = errorSummaryOf(pageOf(payload))
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(errors.getByRole('heading', { name: 'There is a problem' })).toBeInTheDocument()
      expect(errors.getByRole('link', { name: message })).toBeInTheDocument()
    })

    test.each([
      ['"New case", as there is no existing case', [], '#bookmark-choice-2'],
      ['"Existing case", when there is one', [caseResponse()], '#bookmark-choice']
    ])('links the error for no choice to the first that can be made: %s', async (_name, cases, href) => {
      mockGuideAndUser(cases)

      const { payload } = await post({ section: '11-before-you-begin' })

      expect(errorSummaryOf(pageOf(payload)).getByRole('link', { name: /^Select if you are bookmarking/ })).toHaveAttribute('href', href)
    })

    test('saves nothing, saying the service cannot do it now, when the user\'s cases cannot be read', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID, title: 'Claiming the SFI payment' }))
        .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })
        .post('/users').optionally().reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_SERVICE_UNAVAILABLE)

      const { statusCode, payload } = await post({ section: '11-before-you-begin', choice: 'new-case', newCase: 'W7654321' })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_GATEWAY)
      expect(pageOf(payload).getByText('The case bookmarks cannot be read')).toBeInTheDocument()
    })

    test('asks again with the cases as they are now, which the next save checks', async () => {
      mockGuideAndUser([caseResponse()])

      const { payload } = await post({ section: '11-before-you-begin', choice: 'new-case', newCase: '' })

      expect(formOf(pageOf(payload))).toSendInOrder('shown', [caseResponse().key])
    })

    test('takes only SBIs from 105000000 to 999999999 once they are switched on', async () => {
      config.set('featureFlags.sbiBookmarks', true)
      mockGuideAndUser()

      const { statusCode, payload } = await post({ section: '11-before-you-begin', choice: 'new-sbi', newSbi: '104999999' })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(errorSummaryOf(pageOf(payload)).getByRole('link', { name: 'SBI application number must be 9 numbers, from 105000000 to 999999999' })).toBeInTheDocument()
    })

    test('bookmarks the section to a new case, which goes first, then shows the guide at the section', async () => {
      mockGuideAndUser([caseResponse()])
      const patching = nock(GUIDANCE_API_BASE_URL)
        .patch(`/users/${USER_ID}/cases`, [
          { op: 'test', path: '/0/key', value: caseResponse().key },
          { op: 'add', path: '/0', value: { type: 'case', ref: 'W7654321', bookmarks: [{ guideId: GUIDE_ID, section: '2-assign-case', heading: '2 Assign case' }] } }
        ])
        .reply(statusCodes.HTTP_STATUS_NO_CONTENT)

      const { statusCode, headers } = await post({ section: '2-assign-case', choice: 'new-case', newCase: ' w7654321 ', shown: [caseResponse().key] })

      expect(patching.isDone()).toBe(true)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe(`${GUIDE_PAGE}?page=2#2-assign-case`)
    })

    test('bookmarks the section to an existing case, if the cases are still those the page offered', async () => {
      const other = caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', ref: 'W7654321' })
      const existing = caseResponse()
      mockGuideAndUser([other, existing])
      const patching = nock(GUIDANCE_API_BASE_URL)
        .patch(`/users/${USER_ID}/cases`, [
          { op: 'test', path: '/0/key', value: other.key },
          { op: 'test', path: '/1/key', value: existing.key },
          { op: 'add', path: '/1/bookmarks/-', value: { guideId: GUIDE_ID, section: '11-before-you-begin', heading: '1.1 Before you begin' } }
        ])
        .reply(statusCodes.HTTP_STATUS_NO_CONTENT)

      const { headers } = await post({ section: '11-before-you-begin', choice: 'existing-case', existingCase: 'W1234567', shown: [other.key, existing.key] })

      expect(patching.isDone()).toBe(true)
      expect(headers.location).toBe(`${GUIDE_PAGE}?page=1#11-before-you-begin`)
    })

    test('does not bookmark a section to a case twice', async () => {
      mockGuideAndUser([caseResponse({ guides: [{ id: GUIDE_ID, title: 'Claiming the SFI payment', bookmarks: [SECTION] }] })])

      const { statusCode, headers } = await post({ section: '11-before-you-begin', choice: 'new-case', newCase: 'W1234567', shown: [caseResponse().key] })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe(`${GUIDE_PAGE}?page=1#11-before-you-begin`)
    })

    test('asks again, saving nothing, when the cases changed while the page was open', async () => {
      mockGuideAndUser([caseResponse()])
      nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/cases`).reply(statusCodes.HTTP_STATUS_CONFLICT)

      const { statusCode, payload } = await post({ section: '11-before-you-begin', choice: 'existing-case', existingCase: 'W1234567', shown: [caseResponse().key] })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_CONFLICT)
      expect(errorSummaryOf(pageOf(payload)).getByRole('link', { name: 'Your case bookmarks changed while this page was open. Choose again.' })).toBeInTheDocument()
    })

    test('asks again, saving nothing, when the cases are not those the page offered, as when one was removed and made again', async () => {
      mockGuideAndUser([caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c' })])

      const { statusCode, payload } = await post({ section: '11-before-you-begin', choice: 'existing-case', existingCase: 'W1234567', shown: [caseResponse().key] })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_CONFLICT)
      expect(errorSummaryOf(pageOf(payload)).getByRole('link', { name: 'Your case bookmarks changed while this page was open. Choose again.' })).toBeInTheDocument()
    })

    test('asks again, saving nothing, when the hub finds the section bookmarked to the case already, as by another page', async () => {
      mockGuideAndUser([caseResponse()])
      nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/cases`).reply(statusCodes.HTTP_STATUS_UNPROCESSABLE_ENTITY, refusalResponse({ detail: 'A section of a guide is bookmarked to W1234567 twice' }))

      const { statusCode, payload } = await post({ section: '11-before-you-begin', choice: 'existing-case', existingCase: 'W1234567', shown: [caseResponse().key] })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_CONFLICT)
      expect(errorSummaryOf(pageOf(payload)).getByRole('link', { name: 'Your case bookmarks changed while this page was open. Choose again.' })).toBeInTheDocument()
    })

    test('is shown once on the guide', async () => {
      mockGuideAndUser()
      nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/cases`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      const posted = await post({ section: '11-before-you-begin', choice: 'new-case', newCase: 'W7654321' })
      cookie = mergeCookies(cookie, posted.headers['set-cookie'])

      mockGuideAndUser()
      nock(GUIDANCE_API_BASE_URL).post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      const first = pageOf((await get(GUIDE_PAGE)).payload)
      mockGuideAndUser()
      nock(GUIDANCE_API_BASE_URL).post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      const again = pageOf((await get(GUIDE_PAGE)).payload)

      const banner = first.getByRole('alert')
      expect(banner).toHaveClass('govuk-notification-banner--success')
      expect(within(banner).getByRole('heading', { name: '‘1.1 Before you begin’ bookmarked to case ID W7654321' })).toBeInTheDocument()
      expect(again.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})

describe('a guide\'s headings', () => {
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
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server?.stop({ timeout: 0 })
  })

  async function guidePage (cases, markdown) {
    mockGuideAndUser(cases, markdown)
    nock(GUIDANCE_API_BASE_URL).post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)

    return pageOf((await server.inject({ method: 'GET', url: GUIDE_PAGE, headers: { cookie } })).payload)
  }

  /** The section each heading's bookmark is for, as its address names it, in the page's order. */
  function bookmarkedSections (page) {
    return page.getAllByRole('link', { name: /^Bookmark/, hidden: true })
      .map((link) => new URL(link.getAttribute('href'), 'https://hub.example').searchParams.get('section'))
  }

  test('each have a control after them, after the star, to bookmark their section to a case', async () => {
    const page = await guidePage([])
    const { all, star, bookmark } = controlsAfter(page.getByRole('heading', { level: 2, name: '1 Introduction' }))

    expect(all).toEqual([star, bookmark])
    expect(bookmark).toHaveAttribute('href', `${BOOKMARK_PAGE}?section=1-introduction`)
    expect(page.getByRole('link', { name: 'Bookmark to a case: 1.1 Before you begin' })).toHaveAttribute('href', `${BOOKMARK_PAGE}?section=11-before-you-begin`)
    expect(JSON.parse(page.document.querySelector('[data-tiptap-markdown]').dataset.headingBookmarks)).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: `${BOOKMARK_PAGE}?section=11-before-you-begin` })])
    )
  })

  test('have one only where the hub keeps a section ID for them, so not inside a quote or a list', async () => {
    const page = await guidePage([], [MARKDOWN, '', '> ### A quoted note', '', '- ### A listed note'].join('\n'))

    expect(bookmarkedSections(page)).toEqual(['1-introduction', '11-before-you-begin', '2-assign-case'])
    expect(page.document.getElementById('a-quoted-note')).toBeInTheDocument()
  })

  test('say under them which cases they are bookmarked to, offering another', async () => {
    const page = await guidePage([
      caseResponse({ guides: [{ id: GUIDE_ID, title: 'Claiming the SFI payment', bookmarks: [SECTION] }] }),
      caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', type: 'sbi', ref: '123456789', guides: [{ id: GUIDE_ID, title: 'Claiming the SFI payment', bookmarks: [SECTION] }] })
    ])

    expect(page.getByText('Bookmarked to Case W1234567, SBI 123456789')).toHaveClass('app-guide-section-bookmarked')
    expect(page.getByRole('link', { name: 'Bookmarked – add another case: 1.1 Before you begin' })).toBeInTheDocument()
    expect(page.getByRole('link', { name: 'Bookmark to a case: 1 Introduction' })).toBeInTheDocument()
  })

  test('are not marked by a bookmark on another guide\'s section with the same anchor', async () => {
    const page = await guidePage([
      caseResponse({ guides: [{ id: OTHER_GUIDE_ID, title: 'Another guide', bookmarks: [SECTION] }] })
    ])

    expect(page.queryByText(/^Bookmarked to Case W1234567/)).not.toBeInTheDocument()
    expect(page.getByRole('link', { name: 'Bookmark to a case: 1.1 Before you begin' })).toBeInTheDocument()
  })
})

describe('a guide that repeats a heading', () => {
  // "Help" is its title, both its sections' headings and a heading quoted in
  // the first. The page numbers a repeat among all its headings, so the
  // sections' headings are at `help-1` and `help-3`, where the guide's links
  // land; the hub numbers one only among the headings it gives a section ID,
  // and knows the sections as `help` and `help-1`.
  const REPEATED = ['# Help', '', '## Help', '', 'First.', '', '> ### Help', '', '## Help', '', 'Second.'].join('\n')
  const SECOND = { sectionId: '019a0000-0000-7000-8000-000000000021', section: 'help-1', heading: 'Help', position: 0 }

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
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server?.stop({ timeout: 0 })
  })

  function get (url) {
    return server.inject({ method: 'GET', url, headers: { cookie } })
  }

  test('gives each section\'s control the hub\'s anchor, and marks the section bookmarked', async () => {
    mockGuideAndUser([caseResponse({ guides: [{ id: GUIDE_ID, title: 'Help', bookmarks: [SECOND] }] })], REPEATED)
    nock(GUIDANCE_API_BASE_URL).post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)

    const page = pageOf((await get(GUIDE_PAGE)).payload)
    const first = controlsAfter(page.document.getElementById('help-1'))
    const second = controlsAfter(page.document.getElementById('help-3'))

    expect(first.all).toEqual([first.star, first.bookmark])
    expect(first.bookmark).toHaveAttribute('href', `${BOOKMARK_PAGE}?section=help`)
    expect(first.bookmark).not.toHaveClass('app-guide-section-bookmark--active')
    expect(second.all).toEqual([second.star, second.bookmark])
    expect(second.bookmark).toHaveAttribute('href', `${BOOKMARK_PAGE}?section=help-1`)
    expect(second.bookmark).toHaveClass('app-guide-section-bookmark--active')
    expect(page.document.getElementById('help-2')).toBeInTheDocument()
  })

  test.each([
    ['first', 'help', '?page=1#help-1'],
    ['second', 'help-1', '?page=2#help-3']
  ])('bookmarks the %s section by the hub\'s anchor, then shows the guide at its heading', async (_which, section, at) => {
    mockGuideAndUser([], REPEATED)
    const patching = nock(GUIDANCE_API_BASE_URL)
      .patch(`/users/${USER_ID}/cases`, [
        { op: 'add', path: '/0', value: { type: 'case', ref: 'W7654321', bookmarks: [{ guideId: GUIDE_ID, section, heading: 'Help' }] } }
      ])
      .reply(statusCodes.HTTP_STATUS_NO_CONTENT)

    const { headers } = await server.inject({
      method: 'POST', url: BOOKMARK_PAGE, headers: { cookie }, payload: { section, choice: 'new-case', newCase: 'W7654321' }
    })

    expect(patching.isDone()).toBe(true)
    expect(headers.location).toBe(`${GUIDE_PAGE}${at}`)
  })

  test('gives each section\'s star the hub\'s anchor, and its heading\'s anchor on the page to come back to', async () => {
    mockGuideAndUser([], REPEATED)
    nock(GUIDANCE_API_BASE_URL).post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)

    const page = pageOf((await get(GUIDE_PAGE)).payload)

    expect(controlsAfter(page.document.getElementById('help-1')).star.form).toHaveFormValues({ section: 'help', anchor: 'help-1' })
    expect(controlsAfter(page.document.getElementById('help-3')).star.form).toHaveFormValues({ section: 'help-1', anchor: 'help-3' })
  })

  test('pins the second section by the hub\'s anchor, then goes back to its heading', async () => {
    nock(GUIDANCE_API_BASE_URL)
      .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, REPEATED, { 'Content-Type': 'text/plain' })
      .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
    const pinning = nock(GUIDANCE_API_BASE_URL)
      .patch(`/users/${USER_ID}/pins`, [{ op: 'add', path: '/0', value: { guideId: GUIDE_ID, section: 'help-1', heading: 'Help' } }])
      .reply(statusCodes.HTTP_STATUS_NO_CONTENT)

    const { headers } = await server.inject({
      method: 'POST',
      url: '/pin-toggle',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      payload: `guideId=${GUIDE_ID}&pin=true&section=help-1&anchor=help-3&returnTo=${encodeURIComponent(GUIDE_PAGE)}`
    })

    expect(pinning.isDone()).toBe(true)
    expect(headers.location).toBe(`${GUIDE_PAGE}#help-3`)
  })

  test('opens at the heading of the section a link names by the hub\'s anchor, as the side navigation links to it', async () => {
    mockGuideAndUser([], REPEATED)

    const { statusCode, headers } = await get(`${GUIDE_PAGE}?section=help-1`)

    expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(headers.location).toBe(`${GUIDE_PAGE}?page=2#help-3`)
  })
})
