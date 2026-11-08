import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { caseResponse, guideResponse, refusalResponse, userResponse } from '../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../helpers/cookies.js'
import { loginAsDevUser } from '../../helpers/login.js'

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

function mockGuideAndUser (cases = []) {
  nock(GUIDANCE_API_BASE_URL)
    .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID, title: 'Claiming the SFI payment' }))
    .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })
    .post('/users').optionally().reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
    .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ cases }))
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

  function radios (payload) {
    return [...payload.matchAll(/<input class="govuk-radios__input"[^>]*value="([^"]+)"([^>]*)>/g)]
      .map(([, value, rest]) => [value, rest.includes('disabled')])
  }

  describe('the question', () => {
    test('asks about the section the address names, with its heading', async () => {
      mockGuideAndUser()

      const { statusCode, payload } = await get(`${BOOKMARK_PAGE}?section=11-before-you-begin`)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('Bookmark this section to a case')
      expect(payload).toContain('‘1.1 Before you begin’ in Claiming the SFI payment will show under that case in the side navigation.')
      expect(payload).toContain('<input type="hidden" name="section" value="11-before-you-begin">')
      expect(payload).toContain('Bookmark section')
    })

    test('goes back, or cancels, to the guide at the section, changing nothing', async () => {
      mockGuideAndUser()

      const { payload } = await get(`${BOOKMARK_PAGE}?section=2-assign-case`)

      expect(payload.match(/href="\/guides\/[^"]*\?page=2#2-assign-case"/g)).toHaveLength(2)
      expect(payload).toContain('>Back</a>')
      expect(payload).toContain('>Cancel</a>')
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

      expect(radios(payload)).toEqual([
        ['existing-case', true],
        ['new-case', false],
        ['existing-sbi', true],
        ['new-sbi', true]
      ])
      expect(payload).toContain('A letter followed by 7 numbers, for example W1234567')
    })

    test('offers the cases there are, and the SBI choices when switched on', async () => {
      config.set('featureFlags.sbiBookmarks', true)
      mockGuideAndUser([caseResponse(), caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', type: 'sbi', ref: '123456789' })])

      const { payload } = await get(`${BOOKMARK_PAGE}?section=11-before-you-begin`)

      expect(radios(payload)).toEqual([
        ['existing-case', false],
        ['new-case', false],
        ['existing-sbi', false],
        ['new-sbi', false]
      ])
      expect(payload).toContain('<option value="W1234567">W1234567</option>')
      expect(payload).toContain('<option value="123456789">123456789</option>')
    })

    test('sends the cases it offered, in their order, so that saving can tell whether they changed', async () => {
      const second = caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', ref: 'W7654321' })
      mockGuideAndUser([caseResponse(), second])

      const { payload } = await get(`${BOOKMARK_PAGE}?section=11-before-you-begin`)
      const shown = [...payload.matchAll(/<input type="hidden" name="shown" value="([^"]+)">/g)].map(([, key]) => key)

      expect(shown).toEqual([caseResponse().key, second.key])
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

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('There is a problem')
      expect(payload).toContain(message)
    })

    test('asks again with the cases as they are now, which the next save checks', async () => {
      mockGuideAndUser([caseResponse()])

      const { payload } = await post({ section: '11-before-you-begin', choice: 'new-case', newCase: '' })

      expect(payload).toContain(`<input type="hidden" name="shown" value="${caseResponse().key}">`)
    })

    test('takes only SBIs from 105000000 to 999999999 once they are switched on', async () => {
      config.set('featureFlags.sbiBookmarks', true)
      mockGuideAndUser()

      const { statusCode, payload } = await post({ section: '11-before-you-begin', choice: 'new-sbi', newSbi: '104999999' })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
      expect(payload).toContain('SBI application number must be 9 numbers, from 105000000 to 999999999')
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
      expect(payload).toContain('Your case bookmarks changed while this page was open. Choose again.')
    })

    test('asks again, saving nothing, when the cases are not those the page offered, as when one was removed and made again', async () => {
      mockGuideAndUser([caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c' })])

      const { statusCode, payload } = await post({ section: '11-before-you-begin', choice: 'existing-case', existingCase: 'W1234567', shown: [caseResponse().key] })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_CONFLICT)
      expect(payload).toContain('Your case bookmarks changed while this page was open. Choose again.')
    })

    test('asks again, saving nothing, when the hub finds the section bookmarked to the case already, as by another page', async () => {
      mockGuideAndUser([caseResponse()])
      nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/cases`).reply(statusCodes.HTTP_STATUS_UNPROCESSABLE_ENTITY, refusalResponse({ detail: 'A section of a guide is bookmarked to W1234567 twice' }))

      const { statusCode, payload } = await post({ section: '11-before-you-begin', choice: 'existing-case', existingCase: 'W1234567', shown: [caseResponse().key] })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_CONFLICT)
      expect(payload).toContain('Your case bookmarks changed while this page was open. Choose again.')
    })

    test('is shown once on the guide', async () => {
      mockGuideAndUser()
      nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/cases`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      const posted = await post({ section: '11-before-you-begin', choice: 'new-case', newCase: 'W7654321' })
      cookie = mergeCookies(cookie, posted.headers['set-cookie'])

      mockGuideAndUser()
      nock(GUIDANCE_API_BASE_URL).post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      const { payload } = await get(GUIDE_PAGE)
      mockGuideAndUser()
      nock(GUIDANCE_API_BASE_URL).post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      const again = await get(GUIDE_PAGE)

      expect(payload).toContain('govuk-notification-banner--success')
      expect(payload).toContain('‘1.1 Before you begin’ bookmarked to case ID W7654321')
      expect(again.payload).not.toContain('govuk-notification-banner--success')
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

  async function guidePage (cases) {
    mockGuideAndUser(cases)
    nock(GUIDANCE_API_BASE_URL).post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)

    return (await server.inject({ method: 'GET', url: GUIDE_PAGE, headers: { cookie } })).payload
  }

  test('each have a control after them to bookmark their section to a case', async () => {
    const payload = await guidePage([])

    expect(payload).toMatch(/<h2[^>]*id="1-introduction"[^>]*>.*?<\/h2>\s*<a class="app-guide-section-bookmark" href="\/guides\/[^"]*\/bookmark\?section=1-introduction"/)
    expect(payload).toContain(`href="${BOOKMARK_PAGE}?section=11-before-you-begin"`)
    expect(payload).toContain('<span class="govuk-visually-hidden">Bookmark to a case: 1.1 Before you begin</span>')
    expect(payload).toContain('data-heading-bookmarks="[{&quot;href&quot;:&quot;')
  })

  test('say under them which cases they are bookmarked to, offering another', async () => {
    const payload = await guidePage([
      caseResponse({ guides: [{ id: GUIDE_ID, title: 'Claiming the SFI payment', bookmarks: [SECTION] }] }),
      caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', type: 'sbi', ref: '123456789', guides: [{ id: GUIDE_ID, title: 'Claiming the SFI payment', bookmarks: [SECTION] }] })
    ])

    expect(payload).toContain('<p class="app-guide-section-bookmarked">Bookmarked to Case W1234567, SBI 123456789</p>')
    expect(payload).toContain('Bookmarked – add another case: 1.1 Before you begin')
    expect(payload).toContain('Bookmark to a case: 1 Introduction')
  })

  test('are not marked by a bookmark on another guide\'s section with the same anchor', async () => {
    const payload = await guidePage([
      caseResponse({ guides: [{ id: OTHER_GUIDE_ID, title: 'Another guide', bookmarks: [SECTION] }] })
    ])

    expect(payload).not.toContain('Bookmarked to Case W1234567')
    expect(payload).toContain('Bookmark to a case: 1.1 Before you begin')
  })
})
