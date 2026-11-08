import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { initiateUploadResponse } from '../../../fixtures/cdp-uploader.js'
import { caseResponse, guidePageResponse, schemesResponse, userResponse } from '../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../helpers/cookies.js'
import { loginAsDevUser } from '../../helpers/login.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const SIDE_NAVIGATION = '<nav class="app-side-nav" aria-label="Guidance hub">'
// How a browser sends a form, repeating a field for each of its values.
const FORM = { 'content-type': 'application/x-www-form-urlencoded' }

describe('Side navigation', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(() => {
    nock(GUIDANCE_API_BASE_URL).get('/reference/schemes').optionally().reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
    nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
    nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId: 'u-1' }))
  })

  afterEach(() => {
    nock.cleanAll()
    vi.unstubAllEnvs()
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

  describe('the user\'s pinned guides', () => {
    const { id: USER_ID } = userResponse()
    const FIRST = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
    const SECOND = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

    function signedInWith (pinned) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ pinned }))

      return loginAsDevUser(server)
    }

    test('are counted beside "Pinned"', async () => {
      const cookie = await signedInWith([{ id: FIRST, title: 'Claiming a payment' }, { id: SECOND, title: 'Closing a case' }])

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(payload).toMatch(/Pinned<\/span>\s*<span class="app-side-nav__badge">2<span class="govuk-visually-hidden"> guides<\/span><\/span>/)
    })

    test('are counted on the folded navigation\'s icon, and in its name', async () => {
      const signedIn = await signedInWith([{ id: FIRST, title: 'Claiming a payment' }])
      const folded = await server.inject({ method: 'POST', url: '/side-nav/toggle', headers: { cookie: signedIn }, payload: { collapsed: true, returnTo: '/hub' } })
      const cookie = mergeCookies(signedIn, folded.headers['set-cookie'])

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(payload).toContain('<span class="app-side-nav__rail-label">Pinned (1<span class="govuk-visually-hidden"> guides</span>)</span>')
      expect(payload).toMatch(/Pinned \(1[^]*?<span class="app-side-nav__rail-dot" aria-hidden="true">1<\/span>/)
      expect(payload).toContain('<span class="app-side-nav__rail-label">Recently opened</span>')
    })

    test('are not counted when they cannot be had, the page showing all the same', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).not.toContain('app-side-nav__badge')
    })

    async function pinnedSection (pinned) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ pinned }))
      const cookie = await loginAsDevUser(server)
      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })
      const start = payload.indexOf('id="side-nav-pinned"')

      return payload.slice(start, payload.indexOf('</details>\n\n', start))
    }

    test('are listed in the user\'s order, each linking to its guide, with their number', async () => {
      const section = await pinnedSection([{ id: FIRST, title: 'Claiming a payment' }, { id: SECOND, title: 'Closing a case' }])

      expect(section).toMatch(/app-side-nav__section-count">2</)
      expect(section.indexOf(`href="/guides/${FIRST}"`)).toBeGreaterThan(-1)
      expect(section.indexOf(`href="/guides/${SECOND}"`)).toBeGreaterThan(section.indexOf(`/guides/${FIRST}"`))
      expect(section).toContain('data-reorder-list="/pin-order"')
      expect(section).toContain('role="status" data-reorder-status')
    })

    test('each have a menu to open, unpin and move it, moving only where it can go', async () => {
      const section = await pinnedSection([{ id: FIRST, title: 'Claiming a payment' }, { id: SECOND, title: 'Closing a case' }])
      const [first, second] = section.split('<li class="app-side-nav__row"').slice(1)
      const moveForms = (row) => row.split('<form').filter((form) => form.includes('action="/pin-order"'))
      const [firstUp, firstDown] = moveForms(first)
      const [secondUp, secondDown] = moveForms(second)

      expect(first).toContain('More actions for Claiming a payment')
      expect(first).toMatch(/>Open<\/a>/)
      expect(first).toMatch(/action="\/pin-toggle"[\s\S]*name="pin" value="false"[\s\S]*name="position" value="0"[\s\S]*>Unpin<span class="govuk-visually-hidden"> Claiming a payment</)
      expect(firstDown).toMatch(/data-reorder-move="1">[\s\S]*name="from" value="0"[\s\S]*name="to" value="1"[\s\S]*>Move down</)
      expect(firstDown.match(/name="order" value="([^"]+)"/g)).toEqual([`name="order" value="${FIRST}"`, `name="order" value="${SECOND}"`])
      expect(firstDown).not.toContain('name="guideId"')
      expect(secondUp).toMatch(/data-reorder-move="-1">[\s\S]*name="from" value="1"[\s\S]*name="to" value="0"[\s\S]*>Move up</)
      expect(firstUp).toMatch(/data-reorder-move="-1" hidden>[\s\S]*>Move up</)
      expect(secondDown).toMatch(/data-reorder-move="1" hidden>[\s\S]*>Move down</)
    })

    test('say when nothing is pinned yet', async () => {
      const section = await pinnedSection([])

      expect(section).toMatch(/app-side-nav__section-count">0</)
      expect(section).toContain("You haven't pinned any guidance yet.")
    })

    test('move from where the page showed them, then go back to the page\'s pinned guides', async () => {
      nock(GUIDANCE_API_BASE_URL).post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
      const moving = nock(GUIDANCE_API_BASE_URL)
        .patch(`/users/${USER_ID}/pins`, [
          { op: 'test', path: '/0', value: FIRST },
          { op: 'test', path: '/1', value: SECOND },
          { op: 'move', from: '/0', path: '/1' }
        ])
        .reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      const cookie = await loginAsDevUser(server)

      const { statusCode, headers } = await server.inject({
        method: 'POST', url: '/pin-order', headers: { cookie, ...FORM }, payload: `order=${FIRST}&order=${SECOND}&from=0&to=1&returnTo=%2Fhub`
      })

      expect(moving.isDone()).toBe(true)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/hub#side-nav-pinned')
    })

    test('refuse a move that does not send the order the page showed', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({
        method: 'POST', url: '/pin-order', headers: { cookie }, payload: { from: '0', to: '1', returnTo: '/hub' }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test.each([
      ['nothing to show once it is moved', statusCodes.HTTP_STATUS_NO_CONTENT, statusCodes.HTTP_STATUS_NO_CONTENT],
      ['a conflict when they changed since the page showed them', statusCodes.HTTP_STATUS_CONFLICT, statusCodes.HTTP_STATUS_CONFLICT],
      ['a conflict when the move no longer fits them', statusCodes.HTTP_STATUS_UNPROCESSABLE_ENTITY, statusCodes.HTTP_STATUS_CONFLICT]
    ])('answer a script that dragged one with %s', async (_answer, answered, expected) => {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .patch(`/users/${USER_ID}/pins`).reply(answered)
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({
        method: 'POST', url: '/pin-order', headers: { cookie, ...FORM }, payload: `order=${FIRST}&order=${SECOND}&from=0&to=1`
      })

      expect(statusCode).toBe(expected)
    })
  })

  describe('the user\'s case bookmarks', () => {
    const { id: USER_ID } = userResponse()
    const GUIDE = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
    const BEFORE = { sectionId: '019a0000-0000-7000-8000-000000000011', section: '11-before-you-begin', heading: '1.1 Before you begin', position: 1 }
    const ASSIGN = { sectionId: '019a0000-0000-7000-8000-000000000002', section: '2-assign-case', heading: '2 Assign case', position: 0 }

    async function bookmarksSection (cases) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ cases }))
      const cookie = await loginAsDevUser(server)
      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })
      const start = payload.indexOf('id="side-nav-bookmarks"')

      return payload.slice(start, payload.indexOf('app-side-nav__footer', start))
    }

    test('are counted beside "Case bookmarks", one for each case', async () => {
      const section = await bookmarksSection([caseResponse(), caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', ref: 'W7654321' })])

      expect(section).toMatch(/Case bookmarks<\/span>\s*<span class="app-side-nav__section-count">2<span class="govuk-visually-hidden"> cases<\/span>/)
    })

    test('are listed in the user\'s order, each with its guides and their number, each guide with its sections in the guide\'s order', async () => {
      const section = await bookmarksSection([
        caseResponse({ ref: 'W7654321', guides: [{ id: GUIDE, title: 'Claiming a payment', bookmarks: [BEFORE, ASSIGN] }] }),
        caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', type: 'sbi', ref: '123456789' })
      ])

      const shown = [...section.matchAll(/app-side-nav__ref-type">([^<]+)<[^]*?<\/span>([^<]+)<\/span>\s*<span class="app-side-nav__meta">([^<]+)</g)]
        .map(([, type, ref, guides]) => [type, ref.trim(), guides])
      const links = [...section.matchAll(/<a class="app-side-nav__sublink[^"]*" href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
        .map(([, href, text]) => [text, href])

      expect(shown).toEqual([['Case', 'W7654321', '1 guide'], ['SBI', '123456789', '0 guides']])
      expect(links).toEqual([
        ['Claiming a payment', `/guides/${GUIDE}`],
        ['1.1 Before you begin', `/guides/${GUIDE}?section=11-before-you-begin#11-before-you-begin`],
        ['2 Assign case', `/guides/${GUIDE}?section=2-assign-case#2-assign-case`]
      ])
    })

    describe('changed from their menus', () => {
      const K1 = caseResponse().key
      const K2 = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c'
      const OTHER = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
      const INTRO = { sectionId: '019a0000-0000-7000-8000-000000000001', section: '1-introduction', heading: '1 Introduction', position: 0 }
      const ASSIGNED = { ...ASSIGN, position: 2 }
      const CLOSE = { sectionId: '019a0000-0000-7000-8000-000000000003', section: '3-close-case', heading: '3 Close case', position: 1 }
      const W1 = caseResponse({
        guides: [
          { id: GUIDE, title: 'Claiming a payment', bookmarks: [INTRO, ASSIGNED] },
          { id: OTHER, title: 'Closing a case', bookmarks: [CLOSE] }
        ]
      })
      const SBI = caseResponse({ key: K2, type: 'sbi', ref: '123456789', guides: [{ id: GUIDE, title: 'Claiming a payment', bookmarks: [{ ...INTRO }] }] })

      async function postAs (url, payload, cases = [W1, SBI]) {
        nock(GUIDANCE_API_BASE_URL)
          .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
          .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ cases }))
        const cookie = await loginAsDevUser(server)

        return server.inject({ method: 'POST', url, headers: { cookie }, payload })
      }

      function patching (operations) {
        return nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/cases`, operations).reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      }

      test('give each case a menu to remove it and move it, moving only where it can go', async () => {
        const section = await bookmarksSection([W1, SBI])
        const [first] = section.split('<li class="app-side-nav__case"').slice(1)

        expect(first).toContain('More actions for Case W1234567')
        expect(first).toMatch(new RegExp(`action="/case-bookmarks/remove">\\s*<input type="hidden" name="key" value="${K1}">[^]*?>Remove bookmark<`))
        expect(first).toMatch(/data-reorder-move="-1" hidden>/)
        expect(first).toMatch(new RegExp(`action="/case-bookmarks/order" data-reorder-move="1">\\s*<input type="hidden" name="order" value="${K1}"><input type="hidden" name="order" value="${K2}">\\s*<input type="hidden" name="from" value="0">\\s*<input type="hidden" name="to" value="1">`))
      })

      test('give each guide a menu to remove it or move it, and each section one to remove it', async () => {
        const section = await bookmarksSection([W1, SBI])
        const guides = section.slice(section.indexOf('app-side-nav__sublist'), section.indexOf('<li class="app-side-nav__case"', section.indexOf('app-side-nav__sublist')))
        const [first, second] = guides.split('<li data-reorder-id').slice(1)

        expect(first).toContain('More actions for Claiming a payment')
        expect(first).toMatch(new RegExp(`name="guideId" value="${GUIDE}">[^]*?>Remove<span class="govuk-visually-hidden"> Claiming a payment from Case W1234567<`))
        expect(first).toMatch(/data-reorder-move="-1" hidden>/)
        expect(first).toMatch(new RegExp(`action="/case-bookmarks/guide-order" data-reorder-move="1">\\s*<input type="hidden" name="key" value="${K1}">\\s*<input type="hidden" name="order" value="${GUIDE}"><input type="hidden" name="order" value="${OTHER}">\\s*<input type="hidden" name="from" value="0">\\s*<input type="hidden" name="to" value="1">`))
        expect(first).toContain('More actions for 2 Assign case')
        expect(first).toMatch(new RegExp(`name="sectionId" value="${ASSIGN.sectionId}">[^]*?>Remove<span class="govuk-visually-hidden"> 2 Assign case from Case W1234567<`))
        expect(first.slice(first.indexOf('app-side-nav__section-list'))).not.toContain('Move')
        expect(second).toMatch(/data-reorder-move="1" hidden>/)
      })

      test('remove a case, then go back to the page\'s case bookmarks', async () => {
        const removing = patching([
          { op: 'test', path: '/1/key', value: K2 },
          { op: 'remove', path: '/1' }
        ])

        const { statusCode, headers } = await postAs('/case-bookmarks/remove', { key: K2, returnTo: '/hub' })

        expect(removing.isDone()).toBe(true)
        expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(headers.location).toBe('/hub#side-nav-bookmarks')
      })

      test.each([
        [
          'a guide, with all its sections',
          { guideId: GUIDE },
          [
            { op: 'test', path: '/0/key', value: K1 },
            { op: 'test', path: '/0/bookmarks/2/guideId', value: GUIDE },
            { op: 'test', path: '/0/bookmarks/0/guideId', value: GUIDE },
            { op: 'remove', path: '/0/bookmarks/2' },
            { op: 'remove', path: '/0/bookmarks/0' }
          ]
        ],
        [
          'a section',
          { guideId: GUIDE, sectionId: ASSIGN.sectionId },
          [
            { op: 'test', path: '/0/key', value: K1 },
            { op: 'test', path: '/0/bookmarks/2/sectionId', value: ASSIGN.sectionId },
            { op: 'remove', path: '/0/bookmarks/2' }
          ]
        ]
      ])('remove %s from a case, then go back to the page\'s case bookmarks', async (_what, form, operations) => {
        const removing = patching(operations)

        const { statusCode, headers } = await postAs('/case-bookmarks/remove', { key: K1, returnTo: '/hub', ...form })

        expect(removing.isDone()).toBe(true)
        expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(headers.location).toBe('/hub#side-nav-bookmarks')
      })

      test.each([
        ['its last section', { guideId: GUIDE, sectionId: INTRO.sectionId }, { op: 'test', path: '/1/bookmarks/0/sectionId', value: INTRO.sectionId }],
        ['its only guide', { guideId: GUIDE }, { op: 'test', path: '/1/bookmarks/0/guideId', value: GUIDE }]
      ])('remove the case with %s, only if nothing was added to it since', async (_what, form, tested) => {
        const removing = patching([
          { op: 'test', path: '/1/key', value: K2 },
          tested,
          { op: 'remove', path: '/1/bookmarks/0' },
          { op: 'test', path: '/1/bookmarks', value: [] },
          { op: 'remove', path: '/1' }
        ])

        const { statusCode, headers } = await postAs('/case-bookmarks/remove', { key: K2, returnTo: '/hub', ...form })

        expect(removing.isDone()).toBe(true)
        expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(headers.location).toBe('/hub#side-nav-bookmarks')
      })

      test('move a case, answering a script that dragged it with nothing to show', async () => {
        const moving = patching([
          { op: 'test', path: '/0/key', value: K1 },
          { op: 'test', path: '/1/key', value: K2 },
          { op: 'move', from: '/0', path: '/1' }
        ])

        const { statusCode } = await postAs('/case-bookmarks/order', { order: [K1, K2], from: '0', to: '1' })

        expect(moving.isDone()).toBe(true)
        expect(statusCode).toBe(statusCodes.HTTP_STATUS_NO_CONTENT)
      })

      test('move a guide with its sections, in one patch', async () => {
        const moving = patching([
          { op: 'test', path: '/0/key', value: K1 },
          { op: 'test', path: '/0/bookmarks/0/guideId', value: GUIDE },
          { op: 'test', path: '/0/bookmarks/2/guideId', value: GUIDE },
          { op: 'test', path: '/0/bookmarks/1/guideId', value: OTHER },
          { op: 'move', from: '/0/bookmarks/1', path: '/0/bookmarks/0' }
        ])

        const { statusCode } = await postAs('/case-bookmarks/guide-order', { key: K1, order: [GUIDE, OTHER], from: '1', to: '0' })

        expect(moving.isDone()).toBe(true)
        expect(statusCode).toBe(statusCodes.HTTP_STATUS_NO_CONTENT)
      })

      test.each([
        ['/case-bookmarks/order', { order: [K1, K2], from: '1', to: '0', returnTo: '/hub' }],
        ['/case-bookmarks/guide-order', { key: K1, order: [GUIDE, OTHER], from: '1', to: '0', returnTo: '/hub' }]
      ])('move from %s without JavaScript, then go back to the page\'s case bookmarks', async (url, form) => {
        nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/cases`).reply(statusCodes.HTTP_STATUS_NO_CONTENT)

        const { statusCode, headers } = await postAs(url, form)

        expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
        expect(headers.location).toBe('/hub#side-nav-bookmarks')
      })

      test('answer a conflict for guides that are not as the page showed them', async () => {
        const { statusCode } = await postAs('/case-bookmarks/guide-order', { key: K1, order: [OTHER, GUIDE], from: '1', to: '0' })

        expect(statusCode).toBe(statusCodes.HTTP_STATUS_CONFLICT)
      })
    })

    test('say when nothing is bookmarked to a case yet', async () => {
      const section = await bookmarksSection([])

      expect(section).toMatch(/Case bookmarks<\/span>\s*<span class="app-side-nav__section-count">0<span class="govuk-visually-hidden"> cases<\/span>/)
      expect(section).toContain('You haven\'t bookmarked any guidance to a case yet.')
    })
  })

  test('lets the user sign out from its footer', async () => {
    const cookie = await loginAsDevUser(server)

    const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

    expect(payload).toMatch(/app-side-nav__footer"[^]*href="\/logout"[^>]*>[^<]*Sign out/)
  })

  test.each([
    ['Hub.Viewer', 'Viewer'],
    ['Hub.Editor,Hub.Viewer', 'Viewer, Designer'],
    ['Hub.Admin,Hub.Editor,Hub.Viewer', 'Viewer, Designer, Administrator'],
    ['Hub.Viewer,toString', 'Viewer']
  ])('displays the user name and role caption for DEV_USER_ROLES=%s', async (roles, caption) => {
    vi.stubEnv('DEV_USER_ROLES', roles)
    const cookie = await loginAsDevUser(server)

    const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

    expect(payload).toContain('class="app-side-nav__user-name">Dev User</div>')
    expect(payload).toContain(`class="app-side-nav__user-roles">${caption}</div>`)
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
      for (const name of ['Expand navigation', 'Hub', 'Recently opened', 'Pinned', 'Bookmarked guides', 'Upload guidance', 'Sign out']) {
        expect(payload).toContain(`<span class="app-side-nav__rail-label">${name}</span>`)
      }
      expect(payload).not.toContain('Awaiting my review')
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
