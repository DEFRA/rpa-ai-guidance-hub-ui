import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { initiateUploadResponse } from '../../../fixtures/cdp-uploader.js'
import { guidePageResponse, schemesResponse } from '../../../fixtures/guidance-api.js'
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
    const USER_ID = '01a18d45-0000-7000-8000-000000000001'
    const FIRST = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
    const SECOND = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'

    function signedInWith (pinned) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, { id: USER_ID })
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, { id: USER_ID, pinned })

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
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, { id: USER_ID })
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, { id: USER_ID, pinned })
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
      nock(GUIDANCE_API_BASE_URL).post('/users').reply(statusCodes.HTTP_STATUS_CREATED, { id: USER_ID })
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
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, { id: USER_ID })
        .patch(`/users/${USER_ID}/pins`).reply(answered)
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({
        method: 'POST', url: '/pin-order', headers: { cookie, ...FORM }, payload: `order=${FIRST}&order=${SECOND}&from=0&to=1`
      })

      expect(statusCode).toBe(expected)
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
