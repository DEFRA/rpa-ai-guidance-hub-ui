import { constants as statusCodes } from 'node:http2'

import { getNodeText, within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { initiateUploadResponse } from '../../../fixtures/cdp-uploader.js'
import { caseResponse, guidePageResponse, pinResponse, schemesResponse, userResponse } from '../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../helpers/cookies.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf, sideNavOf } from '../../helpers/page.js'
import { SIDE_NAV_MESSAGES } from '../../../fixtures/messages.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
// How a browser sends a form, repeating a field for each of its values.
const FORM = { 'content-type': 'application/x-www-form-urlencoded' }

/** The text of each element, its spacing collapsed, as a reader sees it. */
function textsOf (elements) {
  return elements.map((element) => element.textContent.replaceAll(/\s+/g, ' ').trim())
}

/**
 * One of the side navigation's sections (Pinned guidance, Case bookmarks): a
 * disclosure, found by the label in its summary.
 */
function sectionOf (nav, label) {
  return nav.getByText(label).closest('details')
}

/**
 * The items of a section's own list, not those of the lists inside them. A
 * control in an item is named for what it acts on, with a visually hidden
 * part; a browser hears "Unpin Claiming a payment", but jsdom's accessible
 * names lose the space before the hidden part, so a test finds the control by
 * what it begins with, and checks the whole of what it says with its text.
 */
function itemsOf (list) {
  return [...list.children].filter((child) => child.tagName === 'LI')
}

/** The form a control sends, found by what its name begins with; it may be hidden. */
function formOf (item, begins) {
  return within(item).getByRole('button', { name: new RegExp(`^${begins}`), hidden: true }).form
}

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

  /** The page at `url`, signed in as the dev user unless a cookie is given. */
  async function pageAt (url, cookie) {
    const { payload } = await server.inject({ method: 'GET', url, headers: { cookie: cookie ?? await loginAsDevUser(server) } })

    return pageOf(payload)
  }

  test.each([
    ['the hub', '/hub'],
    ['uploading a guide', '/create-guidance/upload-guide']
  ])('shows on %s when signed in', async (_name, url) => {
    const page = await pageAt(url)

    expect(sideNavOf(page).getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument()
  })

  test.each([
    ['the hub', '/hub'],
    ['uploading a guide', '/create-guidance/upload-guide']
  ])('takes the place of the header on %s when signed in', async (_name, url) => {
    const page = await pageAt(url)
    const nav = sideNavOf(page)

    expect(within(page.document.body).queryByRole('banner')).not.toBeInTheDocument()
    expect(nav.getByRole('img', { name: 'Department for Environment, Food & Rural Affairs' })).toBeInTheDocument()
    expect(nav.getByRole('link', { name: config.get('serviceName') })).toHaveAttribute('href', '/hub')
  })

  describe('the user\'s pinned guides', () => {
    const { id: USER_ID } = userResponse()
    const FIRST = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
    const SECOND = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
    const SECTION = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d99'

    function signedInWith (pinned) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ pinned }))

      return loginAsDevUser(server)
    }

    test('are counted beside "Pinned", one for each pin, guide or section', async () => {
      const cookie = await signedInWith([pinResponse({ id: FIRST, title: 'Claiming a payment' }), pinResponse({ id: SECOND, title: 'Closing a case', sectionId: SECTION, section: '2-close-it', heading: '2 Close it' })])

      const page = await pageAt('/hub', cookie)

      expect(sideNavOf(page).getByRole('link', { name: /^Pinned/ })).toHaveTextContent(/^Pinned 2 pins$/)
    })

    test('are counted on the folded navigation\'s icon, and in its name', async () => {
      const signedIn = await signedInWith([pinResponse({ id: FIRST, title: 'Claiming a payment' })])
      const folded = await server.inject({ method: 'POST', url: '/side-nav/toggle', headers: { cookie: signedIn }, payload: { collapsed: true, returnTo: '/hub' } })
      const cookie = mergeCookies(signedIn, folded.headers['set-cookie'])

      const nav = sideNavOf(await pageAt('/hub', cookie))
      const pinned = nav.getByRole('link', { name: /^Pinned/ })

      expect(within(pinned).getByText('Pinned (1', { exact: false })).toHaveTextContent('Pinned (1 pins)')
      expect(within(pinned).getByText('1', { ignore: '.govuk-visually-hidden' })).toHaveAttribute('aria-hidden', 'true')
      expect(nav.getByRole('link', { name: 'Recently opened' })).toBeInTheDocument()
    })

    test('are not counted when they cannot be had, the page showing all the same', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(sideNavOf(pageOf(payload)).getByRole('link', { name: /^Pinned/ })).toHaveTextContent(/^Pinned$/)
      expect(sideNavOf(pageOf(payload)).getByRole('link', { name: /^Bookmarked/ })).toHaveTextContent(/^Bookmarked$/)
    })

    /** The side navigation's Pinned guidance section, for a user with `pinned`. */
    async function pinnedSection (pinned) {
      const cookie = await signedInWith(pinned)

      return sectionOf(sideNavOf(await pageAt('/hub', cookie)), 'Pinned guidance')
    }

    test('are listed in the user\'s order, each linking to its guide, with their number', async () => {
      const section = await pinnedSection([pinResponse({ id: FIRST, title: 'Claiming a payment' }), pinResponse({ id: SECOND, title: 'Closing a case' })])
      const list = within(section).getByRole('list')

      expect(section.querySelector('summary')).toHaveTextContent('Pinned guidance 2 pinned')
      expect(itemsOf(list).map((item) => within(item).getAllByRole('link')[0].getAttribute('href'))).toEqual([`/guides/${FIRST}`, `/guides/${SECOND}`])
      expect(list).toHaveAttribute('data-reorder-list', '/pin-order')
      expect(within(section).getByRole('status')).toHaveAttribute('data-reorder-status')
    })

    test('each have a menu to open, unpin and move it, moving only where it can go', async () => {
      const section = await pinnedSection([pinResponse({ id: FIRST, title: 'Claiming a payment' }), pinResponse({ id: SECOND, title: 'Closing a case' })])
      const [first, second] = itemsOf(within(section).getByRole('list'))
      const unpin = formOf(first, 'Unpin')
      const firstDown = formOf(first, 'Move down')
      const secondUp = formOf(second, 'Move up')

      expect(within(first).getByText('More actions for Claiming a payment')).toBeInTheDocument()
      expect(within(first).getByRole('link', { name: 'Open' })).toHaveAttribute('href', `/guides/${FIRST}`)
      expect(unpin).toHaveAttribute('action', '/pin-toggle')
      expect(unpin).toHaveFormValues({ pin: 'false', position: '0' })
      expect(within(unpin).getByRole('button')).toHaveTextContent('Unpin Claiming a payment')
      expect(firstDown).toHaveAttribute('data-reorder-move', '1')
      expect(firstDown).toHaveFormValues({ from: '0', to: '1' })
      expect(firstDown).toSendInOrder('order', [FIRST, SECOND])
      expect(firstDown.elements.namedItem('guideId')).toBeNull()
      expect(firstDown).not.toHaveAttribute('hidden')
      expect(secondUp).toHaveAttribute('data-reorder-move', '-1')
      expect(secondUp).toHaveFormValues({ from: '1', to: '0' })
      expect(secondUp).not.toHaveAttribute('hidden')
      expect(formOf(first, 'Move up')).toHaveAttribute('hidden')
      expect(formOf(second, 'Move down')).toHaveAttribute('hidden')
    })

    test('list a pinned section by its heading, with its guide\'s title, linking to the section', async () => {
      const section = await pinnedSection([pinResponse({ id: FIRST, title: 'Claiming a payment' }), pinResponse({ id: SECOND, title: 'Closing a case', sectionId: SECTION, section: '2-close-it', heading: '2 Close it' })])
      const [first, second] = itemsOf(within(section).getByRole('list'))
      const [firstLink] = within(first).getAllByRole('link')
      const [secondLink] = within(second).getAllByRole('link')
      const secondUnpin = formOf(second, 'Unpin')
      const firstUnpin = formOf(first, 'Unpin')

      expect(second).toHaveAttribute('data-reorder-id', `${SECOND}/${SECTION}`)
      expect(second).toHaveAttribute('data-reorder-label', '2 Close it, in Closing a case')
      expect(secondLink).toHaveAttribute('href', `/guides/${SECOND}?section=2-close-it`)
      expect(secondLink).toHaveTextContent('2 Close it, in Closing a case')
      expect(within(secondLink).getByText('Closing a case')).toHaveClass('app-side-nav__in-guide')
      expect(firstLink).toHaveTextContent(/^Claiming a payment$/)
      // Another guide may have a heading of the same name, so its controls name the guide too.
      expect(within(second).getByText('More actions for 2 Close it, in Closing a case')).toBeInTheDocument()
      expect(within(secondUnpin).getByRole('button')).toHaveTextContent('Unpin 2 Close it, in Closing a case')
      expect(within(formOf(second, 'Move up')).getByRole('button', { hidden: true })).toHaveTextContent('Move up 2 Close it, in Closing a case')
      expect(secondUnpin).toHaveAttribute('data-reorder-follows', `${SECOND}/${SECTION}`)
      expect(secondUnpin).toHaveFormValues({ position: '1', sectionId: SECTION })
      expect(firstUnpin).toHaveAttribute('data-reorder-follows', FIRST)
      expect(firstUnpin.elements.namedItem('sectionId')).toBeNull()
      expect(formOf(first, 'Move down')).toSendInOrder('order', [FIRST, `${SECOND}/${SECTION}`])
    })

    test('move a pinned section by its key, testing its guide and its section', async () => {
      nock(GUIDANCE_API_BASE_URL).post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
      const moving = nock(GUIDANCE_API_BASE_URL)
        .patch(`/users/${USER_ID}/pins`, [
          { op: 'test', path: '/0/guideId', value: FIRST },
          { op: 'test', path: '/0/sectionId', value: null },
          { op: 'test', path: '/1/guideId', value: SECOND },
          { op: 'test', path: '/1/sectionId', value: SECTION },
          { op: 'move', from: '/1', path: '/0' }
        ])
        .reply(statusCodes.HTTP_STATUS_NO_CONTENT)
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({
        method: 'POST', url: '/pin-order', headers: { cookie, ...FORM }, payload: `order=${FIRST}&order=${SECOND}%2F${SECTION}&from=1&to=0&returnTo=%2Fhub`
      })

      expect(moving.isDone()).toBe(true)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    })

    test.each([
      ['an id that is not one', 'not-an-id'],
      ['a section with no guide', `/${SECTION}`],
      ['more than a guide and a section', `${FIRST}/${SECTION}/${SECTION}`]
    ])('refuse an order that names a pin by %s', async (_name, key) => {
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({
        method: 'POST', url: '/pin-order', headers: { cookie, ...FORM }, payload: `order=${encodeURIComponent(key)}&from=0&to=0&returnTo=%2Fhub`
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('say when nothing is pinned yet', async () => {
      const section = await pinnedSection([])

      expect(section.querySelector('summary')).toHaveTextContent('Pinned guidance 0 pinned')
      expect(within(section).getByText(SIDE_NAV_MESSAGES.nonePinned)).toBeInTheDocument()
    })

    test('move from where the page showed them, then go back to the page\'s pinned guides', async () => {
      nock(GUIDANCE_API_BASE_URL).post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
      const moving = nock(GUIDANCE_API_BASE_URL)
        .patch(`/users/${USER_ID}/pins`, [
          { op: 'test', path: '/0/guideId', value: FIRST },
          { op: 'test', path: '/0/sectionId', value: null },
          { op: 'test', path: '/1/guideId', value: SECOND },
          { op: 'test', path: '/1/sectionId', value: null },
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

    /** The side navigation's Case bookmarks section, for a user with `cases`. */
    async function bookmarksSection (cases) {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ cases }))
      const cookie = await loginAsDevUser(server)

      return sectionOf(sideNavOf(await pageAt('/hub', cookie)), 'Case bookmarks')
    }

    /** Each case in the section, as its own row: its name, and its menu. */
    function caseRowsOf (section) {
      return itemsOf(within(section).getAllByRole('list')[0]).map((item) => item.firstElementChild)
    }

    test('are counted beside "Case bookmarks", one for each case', async () => {
      const section = await bookmarksSection([caseResponse(), caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', ref: 'W7654321' })])

      expect(section.querySelector('summary')).toHaveTextContent('Case bookmarks 2 cases')
    })

    test('are counted beside "Bookmarked", one for each case', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ cases: [caseResponse(), caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', ref: 'W7654321' })] }))
      const cookie = await loginAsDevUser(server)

      const nav = sideNavOf(await pageAt('/hub', cookie))

      expect(nav.getByRole('link', { name: /^Bookmarked/ })).toHaveTextContent(/^Bookmarked 2 cases$/)
    })

    test('are listed in the user\'s order, each with its guides and their number, each guide with its sections in the guide\'s order', async () => {
      const section = await bookmarksSection([
        caseResponse({ ref: 'W7654321', guides: [{ id: GUIDE, title: 'Claiming a payment', bookmarks: [BEFORE, ASSIGN] }] }),
        caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', type: 'sbi', ref: '123456789' })
      ])

      const shown = caseRowsOf(section).map((row) => [
        within(row).getByText(/^(Case|SBI)$/).textContent,
        getNodeText(within(row).getByText(/^(W\d{7}|\d{9})$/)).trim(),
        within(row).getByText(/ guides?$/, { ignore: '.govuk-visually-hidden' }).textContent
      ])
      const links = within(section).getAllByRole('list', { name: /^Guides bookmarked to / })
        .flatMap((guides) => within(guides).getAllByRole('link'))
        .map((link) => [link.textContent, link.getAttribute('href')])

      expect(shown).toEqual([['Case', 'W7654321', '1 guide'], ['SBI', '123456789', '0 guides']])
      expect(links).toEqual([
        ['Claiming a payment', `/guides/${GUIDE}`],
        ['1.1 Before you begin', `/guides/${GUIDE}?section=11-before-you-begin`],
        ['2 Assign case', `/guides/${GUIDE}?section=2-assign-case`]
      ])
    })

    test('each link to the Bookmarked guides page narrowed to them, by their key, not their reference', async () => {
      const OTHER = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c'
      const section = await bookmarksSection([caseResponse(), caseResponse({ key: OTHER, type: 'sbi', ref: '123456789' })])

      const hrefs = caseRowsOf(section).map((row) => within(row).getByRole('link', { name: /^(Case|SBI)\b/ }).getAttribute('href'))

      expect(hrefs).toEqual([`/hub/bookmarked-guides?case=${caseResponse().key}`, `/hub/bookmarked-guides?case=${OTHER}`])
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
        const [first] = caseRowsOf(await bookmarksSection([W1, SBI]))
        const remove = formOf(first, 'Remove bookmark')
        const moveDown = formOf(first, 'Move down')

        expect(within(first).getByText('More actions for Case W1234567')).toBeInTheDocument()
        expect(remove).toHaveAttribute('action', '/case-bookmarks/remove')
        expect(remove).toHaveFormValues({ key: K1 })
        expect(formOf(first, 'Move up')).toHaveAttribute('hidden')
        expect(moveDown).toHaveAttribute('action', '/case-bookmarks/order')
        expect(moveDown).toHaveAttribute('data-reorder-move', '1')
        expect(moveDown).toHaveFormValues({ from: '0', to: '1' })
        expect(moveDown).toSendInOrder('order', [K1, K2])
      })

      test('give each guide a menu to remove it or move it, and each section one to remove it', async () => {
        const section = await bookmarksSection([W1, SBI])
        const guides = within(section).getByRole('list', { name: 'Guides bookmarked to Case W1234567' })
        const [first, second] = itemsOf(guides)
        const guideRow = first.firstElementChild
        const sections = within(first).getByRole('list', { name: 'Bookmarked sections of Claiming a payment' })
        const assign = itemsOf(sections)[1]
        const removeGuide = formOf(guideRow, 'Remove')
        const moveDown = formOf(guideRow, 'Move down')
        const removeSection = formOf(assign, 'Remove')

        expect(within(guideRow).getByText('More actions for Claiming a payment')).toBeInTheDocument()
        expect(removeGuide).toHaveFormValues({ guideId: GUIDE })
        expect(within(removeGuide).getByRole('button')).toHaveTextContent('Remove Claiming a payment from Case W1234567')
        expect(formOf(guideRow, 'Move up')).toHaveAttribute('hidden')
        expect(moveDown).toHaveAttribute('action', '/case-bookmarks/guide-order')
        expect(moveDown).toHaveAttribute('data-reorder-move', '1')
        expect(moveDown).toHaveFormValues({ key: K1, from: '0', to: '1' })
        expect(moveDown).toSendInOrder('order', [GUIDE, OTHER])
        expect(within(assign).getByText('More actions for 2 Assign case, in Claiming a payment')).toBeInTheDocument()
        expect(removeSection).toHaveFormValues({ sectionId: ASSIGN.sectionId })
        expect(within(removeSection).getByRole('button')).toHaveTextContent('Remove 2 Assign case, in Claiming a payment, from Case W1234567')
        expect(within(sections).queryAllByRole('button', { name: /^Move/, hidden: true })).toEqual([])
        expect(formOf(second.firstElementChild, 'Move down')).toHaveAttribute('hidden')
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

      expect(section.querySelector('summary')).toHaveTextContent('Case bookmarks 0 cases')
      expect(within(section).getByText(SIDE_NAV_MESSAGES.noCaseBookmarks)).toBeInTheDocument()
    })
  })

  test('lets the user sign out from its footer', async () => {
    const nav = sideNavOf(await pageAt('/hub'))

    expect(nav.getAllByRole('list').at(-1)).toContainElement(nav.getByRole('link', { name: 'Sign out' }))
    expect(nav.getByRole('link', { name: 'Sign out' })).toHaveAttribute('href', '/logout')
  })

  test.each([
    ['Hub.Viewer', 'Viewer'],
    ['Hub.Editor,Hub.Viewer', 'Viewer, Maintainer'],
    ['Hub.Admin,Hub.Editor,Hub.Viewer', 'Viewer, Maintainer, Administrator'],
    ['Hub.Viewer,toString', 'Viewer']
  ])('displays the user name and role caption for DEV_USER_ROLES=%s', async (roles, caption) => {
    vi.stubEnv('DEV_USER_ROLES', roles)

    const nav = sideNavOf(await pageAt('/hub'))

    expect(nav.getByText('Dev User').nextElementSibling).toHaveTextContent(new RegExp(`^${caption}$`))
  })

  describe('contents', () => {
    async function navOf (url) {
      return sideNavOf(await pageAt(url))
    }

    test('has a search box that searches from the hub', async () => {
      const nav = await navOf('/create-guidance/upload-guide')
      const search = nav.getByRole('search')

      expect(search).toHaveAttribute('action', '/hub')
      expect(search).toHaveAttribute('method', 'get')
      expect(within(search).getByRole('searchbox', { name: 'Search or ask question' })).toHaveAttribute('name', 'search')
    })

    test('leaves the search to the hub\'s own search box on the hub', async () => {
      const nav = await navOf('/hub')

      expect(nav.queryByRole('search')).not.toBeInTheDocument()
    })

    test('links to the hub and each list of guides, then a maintainer\'s work, in order', async () => {
      const nav = await navOf('/hub')
      const links = [
        ...within(nav.getAllByRole('list')[0]).getAllByRole('link'),
        ...within(nav.getByRole('list', { name: 'Maintenance' })).getAllByRole('link')
      ]

      expect(textsOf(links).map((text, index) => [text, links[index].getAttribute('href')])).toEqual([
        ['Hub', '/hub'],
        ['Recently opened', '/hub/recently-opened'],
        ['Pinned', '/hub/pinned'],
        ['Bookmarked', '/hub/bookmarked-guides'],
        ['Upload guidance', '/create-guidance/upload-guide']
      ])
      expect(nav.getByRole('heading', { name: 'Maintenance' })).toBeInTheDocument()
    })

    test('has sections for pinned guidance and case bookmarks, empty for now', async () => {
      const nav = await navOf('/hub')

      expect(sectionOf(nav, 'Pinned guidance')).toHaveTextContent(SIDE_NAV_MESSAGES.nonePinned)
      expect(sectionOf(nav, 'Case bookmarks')).toHaveTextContent(SIDE_NAV_MESSAGES.noCaseBookmarks)
    })

    test.each([
      ['/hub', 'Hub'],
      ['/hub/recently-opened', 'Recently opened'],
      ['/hub/pinned', 'Pinned'],
      ['/hub/bookmarked-guides', 'Bookmarked'],
      ['/create-guidance/upload-guide', 'Upload guidance']
    ])('marks the current page on %s', async (url, current) => {
      const nav = await navOf(url)

      expect(textsOf(nav.getAllByRole('link', { current: 'page' }))).toEqual([current])
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

    test('offers to fold the navigation away, coming back to the same page', async () => {
      const cookie = await loginAsDevUser(server)

      const page = await pageAt('/create-guidance/upload-guide?step=1', cookie)
      const toggle = sideNavOf(page).getByRole('button', { name: 'Collapse navigation' }).form

      expect(toggle).toHaveAttribute('action', '/side-nav/toggle')
      expect(toggle).toHaveAttribute('method', 'post')
      expect(toggle).toHaveAttribute('hidden')
      expect(toggle).toHaveFormValues({ collapsed: 'true', returnTo: '/create-guidance/upload-guide?step=1' })
    })

    test('folds down to its icons, back on the page it was folded on', async () => {
      const signedIn = await loginAsDevUser(server)

      const { response, cookie } = await fold(signedIn, true, '/hub')
      const page = await pageAt('/hub', cookie)
      const nav = sideNavOf(page)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/hub')
      expect(nav.queryByRole('button', { name: 'Collapse navigation' })).not.toBeInTheDocument()
      expect(nav.getByRole('button', { name: 'Expand navigation' }).form).toHaveFormValues({ collapsed: 'false' })
      for (const name of ['Hub', 'Recently opened', 'Pinned', 'Bookmarked', 'Upload guidance', 'Sign out']) {
        expect(nav.getByRole('link', { name })).toBeInTheDocument()
      }
      expect(page.document.body).not.toHaveTextContent('Awaiting my review')
      expect(nav.queryByText('Pinned guidance')).not.toBeInTheDocument()
      expect(nav.queryByText('Case bookmarks')).not.toBeInTheDocument()
      expect(nav.queryByRole('search')).not.toBeInTheDocument()
    })

    test('keeps a maintainer\'s work in a list of its own, after the lists of guides', async () => {
      const signedIn = await loginAsDevUser(server)

      const { cookie } = await fold(signedIn, true, '/hub')
      const nav = sideNavOf(await pageAt('/hub', cookie))

      const lists = nav.getAllByRole('list')
      const maintenance = nav.getByRole('list', { name: 'Maintenance' })
      expect(lists.indexOf(maintenance)).toBe(lists.indexOf(nav.getByRole('link', { name: 'Bookmarked' }).closest('ul')) + 1)
      expect(maintenance).toContainElement(nav.getByRole('link', { name: 'Upload guidance' }))
    })

    test('stays folded on the next page, for the session', async () => {
      const signedIn = await loginAsDevUser(server)

      const { cookie } = await fold(signedIn, true, '/hub')
      const nav = sideNavOf(await pageAt('/create-guidance/upload-guide', cookie))

      expect(nav.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument()
    })

    test('unfolds again', async () => {
      const signedIn = await loginAsDevUser(server)

      const folded = await fold(signedIn, true, '/hub')
      const { cookie } = await fold(folded.cookie, false, '/hub')
      const nav = sideNavOf(await pageAt('/hub', cookie))

      expect(nav.getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument()
      expect(nav.queryByRole('button', { name: 'Expand navigation' })).not.toBeInTheDocument()
    })

    test('goes back to the hub, not to another site', async () => {
      const signedIn = await loginAsDevUser(server)

      const { response } = await fold(signedIn, true, 'https://example.com/elsewhere')

      expect(response.headers.location).toBe('/hub')
    })
  })

  test('leaves the header on the sign-in page', async () => {
    const { payload } = await server.inject({ method: 'GET', url: '/' })

    expect(within(pageOf(payload).document.body).getByRole('banner')).toBeInTheDocument()
  })

  test('does not show on the sign-in page', async () => {
    const { payload } = await server.inject({ method: 'GET', url: '/' })

    const body = within(pageOf(payload).document.body)
    expect(body.getAllByText(/Sign in/).length).toBeGreaterThan(0)
    expect(body.queryByRole('navigation', { name: 'Guidance hub' })).not.toBeInTheDocument()
  })
})
