import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guideResponse, pinResponse, userResponse, versionResponse } from '../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../helpers/cookies.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf, sideNavOf } from '../../helpers/page.js'
import { keepPreferencesInTheApi } from '../../helpers/preferences-api.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const GUIDE_URL = `/guides/${GUIDE_ID}`

const MARKDOWN = [
  '# Claiming the SFI payment',
  '',
  '## Introduction',
  '',
  'Start here.',
  '',
  '### Before you begin',
  '',
  'Continue to section [2 Assign case](#assign-case) or [Before you begin](#before-you-begin).',
  '',
  '- check one',
  '- check two',
  '',
  '![](../assets/abc123.png)',
  '',
  '## Assign case',
  '',
  'Assign it.',
  '',
  '## Close case',
  '',
  'Close it.'
].join('\n')

function mockGuide ({ guide = guideResponse({ id: GUIDE_ID }), markdown = MARKDOWN } = {}) {
  nock(GUIDANCE_API_BASE_URL)
    .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guide)
    .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, markdown, { 'Content-Type': 'text/plain' })
}

/**
 * Each page of the guide, as the server draws it: every section is there, for
 * the browser's find-in-page, and those not being read are hidden until it
 * finds a match in one.
 */
function pagesOf (page) {
  return [...page.document.querySelectorAll('[data-guide-page]')]
}

/** The section being read, as drawn without the viewer, for a browser without JavaScript. */
function fallbackOf (page) {
  return pagesOf(page).find((guidePage) => !guidePage.hidden).querySelector('.app-guide-markdown__fallback')
}

/** The guide's information, which its button beside the title shows and hides. */
function informationOf (page) {
  return page.document.getElementById(page.getByRole('button', { name: 'Guide information' }).getAttribute('aria-controls'))
}

describe('#guideController', () => {
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
    await server?.stop({ timeout: 0 })
  })

  function get (url) {
    return server.inject({ method: 'GET', url, headers: { cookie } })
  }

  /** The guide's page at `url`. */
  async function guideAt (url = GUIDE_URL, headers = { cookie }) {
    const { payload } = await server.inject({ method: 'GET', url, headers })

    return pageOf(payload)
  }

  // A guide opens whole; these show it a section at a time, as a user who
  // chose the stepper sees it.
  function guideInStepperAt (url = GUIDE_URL) {
    keepPreferencesInTheApi({ guideFormat: 'stepper' })

    return guideAt(url)
  }

  describe('GET /guides/{guideId}', () => {
    test('shows the title as the one main heading, with its version, Live tag and date', async () => {
      mockGuide()

      const { statusCode, payload } = await get(GUIDE_URL)

      const page = pageOf(payload)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(within(page.document.body).getAllByRole('heading', { level: 1 })).toEqual([page.getByRole('heading', { level: 1, name: 'Claiming the SFI payment' })])
      expect(page.getByText('Version 1.0')).toHaveClass('govuk-tag--green')
      expect(page.getByText('Live')).toBeInTheDocument()
      expect(page.getByText('Updated 6 October 2026')).toBeInTheDocument()
    })

    test('shows no version for a guide whose latest version has no number', async () => {
      mockGuide({ guide: guideResponse({ id: GUIDE_ID, versions: [versionResponse({ versionNumber: null })] }) })

      const page = await guideAt()

      expect(page.queryByText(/^Version /)).not.toBeInTheDocument()
      expect(page.getByText('Live').parentElement.querySelectorAll('.govuk-tag')).toHaveLength(1)
    })

    test('shows how far through each page of the guide the reader is, without an inline style', async () => {
      mockGuide()

      const page = await guideInStepperAt()
      const widths = page.document.querySelector('style[data-progress-style]')

      expect(pagesOf(page)[0].querySelector('[role="presentation"]')).toHaveClass('app-progress__track', 'app-guide-progress')
      expect(widths).toHaveTextContent('#guide-progress-bar-1 { --progress-width: 33%; }')
      expect(widths).toHaveTextContent('#guide-progress-bar-3 { --progress-width: 100%; }')
      expect(page.document.querySelector('[style*="width"]')).toBeNull()
    })

    test('shows the section being read, and where the reader is', async () => {
      mockGuide()

      const page = await guideInStepperAt(`${GUIDE_URL}?section=assign-case`)
      const shown = pagesOf(page).filter((guidePage) => !guidePage.hidden)

      expect(shown).toHaveLength(1)
      expect(shown[0]).toHaveAttribute('data-guide-page', '2')
      expect(shown[0]).toHaveTextContent('Page 2 of 3')
    })

    test('keeps the other sections for find-in-page, hidden until it finds a match', async () => {
      mockGuide()

      const [first, second, third] = pagesOf(await guideInStepperAt())

      expect(first).not.toHaveAttribute('hidden')
      expect(second).toHaveAttribute('hidden', 'until-found')
      expect(third).toHaveAttribute('hidden', 'until-found')
      expect(second).toHaveTextContent('Assign it.')
      expect(third).toHaveTextContent('Close it.')
    })

    test('gives only the section being read to the viewer', async () => {
      mockGuide()

      const page = await guideInStepperAt()
      const markdown = page.document.querySelectorAll('script[type="application/json"]')

      expect(page.document.querySelectorAll('[data-tiptap-markdown]')).toHaveLength(1)
      expect(markdown).toHaveLength(1)
      expect(JSON.parse(markdown[0].textContent)).not.toContain('Assign it.')
    })

    test('lists every section in the contents, linking to each', async () => {
      mockGuide()

      const contents = within((await guideInStepperAt()).getByRole('navigation', { name: 'Contents' }))
      const assign = contents.getByRole('link', { name: 'Assign case' })

      expect(contents.getByRole('link', { name: 'Introduction', current: 'page' })).toHaveAttribute('href', `${GUIDE_URL}?section=introduction`)
      expect(assign).toHaveAttribute('href', `${GUIDE_URL}?section=assign-case`)
      expect(assign).not.toHaveAttribute('aria-current')
      expect(contents.getByRole('link', { name: 'Close case' })).toHaveAttribute('href', `${GUIDE_URL}?section=close-case`)
      expect(assign.parentElement).toHaveAttribute('data-guide-contents-page', '2')
    })

    test.each([
      ['a section', 'assign-case', '2'],
      ['a heading inside a section', 'before-you-begin', '1']
    ])('shows the page with %s an address names, without sending the reader on', async (_case, section, pageNumber) => {
      mockGuide()

      const shown = pagesOf(await guideInStepperAt(`${GUIDE_URL}?section=${section}`)).filter((guidePage) => !guidePage.hidden)

      expect(shown).toHaveLength(1)
      expect(shown[0]).toHaveAttribute('data-guide-page', pageNumber)
    })

    test('opens at the first page when the address names a section the guide has not', async () => {
      mockGuide()

      const contents = within((await guideInStepperAt(`${GUIDE_URL}?section=never`)).getByRole('navigation', { name: 'Contents' }))

      expect(contents.getByRole('link', { current: 'page' })).toHaveTextContent('Introduction')
    })

    test('names the section a Next or Previous link goes to', async () => {
      mockGuide()

      const page = await guideInStepperAt(`${GUIDE_URL}?section=assign-case`)
      const pagination = within(page.getByRole('navigation', { name: 'Pagination' }))

      expect(page.getByText('Page 2 of 3')).toBeInTheDocument()
      expect(pagination.getByRole('link', { name: /Introduction$/ })).toHaveAttribute('rel', 'prev')
      expect(pagination.getByRole('link', { name: /Close case$/ })).toHaveAttribute('rel', 'next')
    })

    test('has no Previous link on the first page and no Next link on the last', async () => {
      mockGuide()

      const [first, , last] = pagesOf(await guideInStepperAt()).map((guidePage) => within(guidePage))

      expect(first.queryByRole('link', { name: /^Previous/, hidden: true })).not.toBeInTheDocument()
      expect(first.getByRole('link', { name: /^Next/, hidden: true })).toBeInTheDocument()
      expect(last.getByRole('link', { name: /^Previous/, hidden: true })).toBeInTheDocument()
      expect(last.queryByRole('link', { name: /^Next/, hidden: true })).not.toBeInTheDocument()
    })

    test('renders the section as a fallback and for the viewer, its images served by the app', async () => {
      mockGuide()

      const page = await guideAt()
      const fallback = fallbackOf(page)

      expect(fallback.closest('[data-tiptap-markdown]').querySelector('script[type="application/json"]')).toBeInTheDocument()
      expect(within(fallback).getByRole('heading', { level: 3, name: 'Before you begin' })).toHaveAttribute('id', 'before-you-begin')
      expect(fallback.querySelector('img')).toHaveAttribute('src', `${GUIDE_URL}/assets/abc123.png`)
    })

    test('colours the parts of a note to fill in without the viewer, by class and not by style', async () => {
      mockGuide({ markdown: '## Section\n\nComplete the parts in [red]{.red}.\n\n> Version used:[&lt;version&gt;]{.red}' })

      const fallback = fallbackOf(await guideAt())

      expect(within(fallback).getByText('red')).toHaveClass('markdown-preview__text--red')
      expect(within(fallback).getByText('<version>')).toHaveClass('markdown-preview__text--red')
      expect(fallback).not.toHaveTextContent('{.red}')
      expect(fallback.querySelector('span[style]')).toBeNull()
    })

    test('takes a link to another section to the page that has it, and leave one to this page', async () => {
      mockGuide()

      const page = await guideInStepperAt()
      const fallback = within(fallbackOf(page))

      expect(fallback.getByRole('link', { name: '2 Assign case' })).toHaveAttribute('href', `${GUIDE_URL}?section=assign-case#assign-case`)
      expect(fallback.getByRole('link', { name: 'Before you begin' })).toHaveAttribute('href', '#before-you-begin')
      expect(page.getByRole('heading', { level: 2, name: 'Introduction' })).toHaveAttribute('id', 'introduction')
      expect(page.document.querySelector('[data-tiptap-markdown]')).toHaveAttribute('data-heading-ids', '["before-you-begin"]')
    })

    test('keeps the id of a section heading that cannot be bookmarked, so links to it still arrive', async () => {
      mockGuide({ markdown: '# Claims\n\nOverview\n--------\n\nSee [Overview](#overview).\n\n## Assign case\n\nAssign it.' })

      const page = await guideAt()

      expect(page.getByRole('heading', { level: 2, name: 'Overview' })).toHaveAttribute('id', 'overview')
    })

    test('describes the guide, with its owner as a link', async () => {
      mockGuide()

      const information = informationOf(await guideAt())

      expect(information).toHaveTextContent('Sustainable Farming Incentive (SFI)')
      expect(information).toHaveTextContent('Processor')
      expect(information).toHaveTextContent('CRM')
      expect(within(information).getByRole('link', { hidden: true })).toHaveAttribute('href', 'mailto:owner%40example.com')
    })

    test('does not offer to change the guide', async () => {
      mockGuide()

      const page = await guideAt()

      expect(page.queryByRole('textbox')).not.toBeInTheDocument()
      expect(page.document.querySelector('[contenteditable="true"]')).toBeNull()
      expect(page.document.querySelector('[data-tiptap-editable]')).toBeNull()
    })

    test('goes back to the hub', async () => {
      mockGuide()

      const back = (await guideAt()).getByRole('link', { name: 'Back' })

      expect(back).toHaveAttribute('href', '/hub')
      expect(back).toHaveClass('govuk-back-link')
    })

    test('escapes a hostile title, owner and Markdown', async () => {
      const hostile = guideResponse({
        id: GUIDE_ID,
        metadata: { guideTitle: '<img src=x onerror=alert(1)>', owner: '"><script>alert(1)</script>' },
        versions: [{ ...guideResponse().versions[0], title: '<script>alert("title")</script>' }]
      })
      mockGuide({
        guide: hostile,
        markdown: '## Section\n\n<script>alert("body")</script>\n\n[x](javascript:alert(1))'
      })

      const page = await guideAt()
      const scripts = [...page.document.querySelectorAll('script')].map((script) => script.textContent)

      expect(scripts.filter((script) => script.startsWith('alert'))).toEqual([])
      expect(page.document.querySelector('img[src="x"]')).toBeNull()
      expect(page.document.querySelector('a[href^="javascript:"]')).toBeNull()
      expect(page.getByRole('heading', { level: 1, name: '<script>alert("title")</script>' })).toBeInTheDocument()
    })

    test('does not let Markdown close the script element carrying it', async () => {
      mockGuide({ markdown: '## Section\n\n</script><script>alert(1)</script>' })

      const page = await guideAt()
      const [markdown] = page.document.querySelectorAll('script[type="application/json"]')

      expect(JSON.parse(markdown.textContent)).toContain('</script><script>alert(1)</script>')
      expect([...page.document.querySelectorAll('script')].map((script) => script.textContent)).not.toContain('alert(1)')
    })

    test('says the guide is not found when the API has none', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_NOT_FOUND)
        .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_NOT_FOUND)

      const { statusCode, payload } = await get(GUIDE_URL)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
      expect(pageOf(payload).getByText('Page not found')).toBeInTheDocument()
    })

    test('says the guide is not found for an address that cannot be a guide', async () => {
      const { statusCode } = await get('/guides/not-a-guide')

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })
  })

  describe('pinning it', () => {
    const { id: USER_ID } = userResponse()

    test.each([
      ['Pin guide', [], 'true'],
      ['Unpin guide', [pinResponse({ id: GUIDE_ID, title: 'Claiming the SFI payment' })], 'false']
    ])('is offered as %s, beside the guide\'s tags', async (label, pinned, pin) => {
      mockGuide()
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ pinned }))

      const page = await guideAt()
      const button = page.getByRole('button', { name: label })

      expect(button.form).toHaveAttribute('action', '/pin-toggle')
      expect(button.form).toHaveFormValues({ pin, returnTo: GUIDE_URL })
      expect(button.form.parentElement).toContainElement(page.getByText('Live'))
    })

    test('is not offered when the user\'s pins cannot be had', async () => {
      mockGuide()

      const page = await guideAt()

      expect(page.queryByRole('button', { name: /^(Pin|Unpin) guide$/ })).not.toBeInTheDocument()
    })
  })

  describe('pinning a section', () => {
    const { id: USER_ID } = userResponse()
    const OTHER_GUIDE = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'
    const SECTION_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d99'
    const FORM = { 'content-type': 'application/x-www-form-urlencoded' }

    function signedInWith (pinned) {
      return nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .get(`/users/${USER_ID}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ pinned }))
    }

    function post (payload) {
      return server.inject({ method: 'POST', url: '/pin-toggle', headers: { cookie, ...FORM }, payload })
    }

    test('is offered by a star before the bookmark of each heading, the section\'s own and those inside it', async () => {
      mockGuide()
      signedInWith([])

      const page = await guideAt()
      const star = page.getByRole('button', { name: 'Pin section: Introduction' })
      const bookmark = page.getByRole('link', { name: 'Bookmark to a case: Introduction' })

      expect(star.form).toHaveFormValues({ guideId: GUIDE_ID, pin: 'true', returnTo: GUIDE_URL })
      expect(page.getByRole('button', { name: 'Pin section: Before you begin' })).toBeInTheDocument()
      expect([...star.closest('.app-guide-heading-row').querySelectorAll('button, a')]).toEqual([star, bookmark])
    })

    test('shows a pinned section by a filled star, which unpins it from where the user\'s pins have it', async () => {
      mockGuide()
      signedInWith([pinResponse({ id: OTHER_GUIDE }), pinResponse({ id: GUIDE_ID, sectionId: SECTION_ID, section: 'before-you-begin', heading: 'Before you begin' })])

      const page = await guideAt()
      const star = page.getByRole('button', { name: 'Unpin section: Before you begin' })

      expect(star.form).toHaveAttribute('data-reorder-follows', `${GUIDE_ID}/${SECTION_ID}`)
      expect(star.form).toHaveFormValues({ pin: 'false', position: '1', sectionId: SECTION_ID })
      expect(page.getByRole('button', { name: 'Pin section: Introduction' })).toBeInTheDocument()
    })

    test('does not pin the whole guide', async () => {
      mockGuide()
      signedInWith([pinResponse({ id: GUIDE_ID, sectionId: SECTION_ID, section: 'before-you-begin', heading: 'Before you begin' })])

      const { form } = (await guideAt()).getByRole('button', { name: 'Pin guide' })

      expect(form).toHaveFormValues({ pin: 'true' })
      expect(form).not.toHaveAttribute('data-reorder-follows')
    })

    test('is not offered when the user\'s pins cannot be had, though bookmarking is', async () => {
      mockGuide()

      const page = await guideAt()

      expect(page.queryByRole('button', { name: /^(Pin|Unpin) section/ })).not.toBeInTheDocument()
      expect(page.getByRole('link', { name: 'Bookmark to a case: Introduction' })).toBeInTheDocument()
    })

    test('pins it by its anchor, with its heading as the guide has it, then goes back to the heading', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
      const pinning = nock(GUIDANCE_API_BASE_URL)
        .patch(`/users/${USER_ID}/pins`, [{ op: 'add', path: '/0', value: { guideId: GUIDE_ID, section: 'before-you-begin', heading: 'Before you begin' } }])
        .reply(statusCodes.HTTP_STATUS_NO_CONTENT)

      const { statusCode, headers } = await post(`guideId=${GUIDE_ID}&pin=true&section=before-you-begin&anchor=before-you-begin&returnTo=${encodeURIComponent(GUIDE_URL)}`)

      expect(pinning.isDone()).toBe(true)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe(`${GUIDE_URL}#before-you-begin`)
    })

    test('is refused for a section the guide does not have', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })

      const { statusCode } = await post(`guideId=${GUIDE_ID}&pin=true&section=not-a-heading&returnTo=${encodeURIComponent(GUIDE_URL)}`)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })

    test('unpins it from where the page showed it, if it is still there, then goes back to the heading', async () => {
      nock(GUIDANCE_API_BASE_URL).post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
      const unpinning = nock(GUIDANCE_API_BASE_URL)
        .patch(`/users/${USER_ID}/pins`, [
          { op: 'test', path: '/1/guideId', value: GUIDE_ID },
          { op: 'test', path: '/1/sectionId', value: SECTION_ID },
          { op: 'remove', path: '/1' }
        ])
        .reply(statusCodes.HTTP_STATUS_NO_CONTENT)

      const { statusCode, headers } = await post(`guideId=${GUIDE_ID}&pin=false&position=1&sectionId=${SECTION_ID}&section=before-you-begin&anchor=before-you-begin&returnTo=${encodeURIComponent(GUIDE_URL)}`)

      expect(unpinning.isDone()).toBe(true)
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe(`${GUIDE_URL}#before-you-begin`)
    })

    function unpinGoingBackTo (anchor) {
      nock(GUIDANCE_API_BASE_URL).post('/users').optionally().reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
      nock(GUIDANCE_API_BASE_URL).patch(`/users/${USER_ID}/pins`).optionally().reply(statusCodes.HTTP_STATUS_NO_CONTENT)

      return post(`guideId=${GUIDE_ID}&pin=false&position=1&sectionId=${SECTION_ID}&anchor=${encodeURIComponent(anchor)}&returnTo=${encodeURIComponent(GUIDE_URL)}`)
    }

    test('goes back to a heading whose anchor has letters beyond A to Z, and _, as a heading\'s can', async () => {
      const { headers } = await unpinGoingBackTo('før_you-begin')

      expect(headers.location).toBe(`${GUIDE_URL}#f%C3%B8r_you-begin`)
    })

    test('is refused when it names a place on the page by anything else', async () => {
      const { statusCode } = await unpinGoingBackTo('a#b')

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })
  })

  describe('as one the user opened recently', () => {
    const { id: USER_ID } = userResponse()

    function mockRecording () {
      return nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .post(`/users/${USER_ID}/recently-opened`, { guideId: GUIDE_ID }).reply(statusCodes.HTTP_STATUS_NO_CONTENT)
    }

    test('is recorded when it is opened', async () => {
      mockGuide()
      const recording = mockRecording()

      const { statusCode } = await get(GUIDE_URL)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(recording.isDone()).toBe(true)
    })

    test.each(['introduction', 'assign-case'])('is recorded when a link opens it at section %s', async (section) => {
      mockGuide()
      const recording = mockRecording()

      const { statusCode } = await get(`${GUIDE_URL}?section=${section}#${section}`)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(recording.isDone()).toBe(true)
    })

    test('still opens when the hub cannot record it', async () => {
      mockGuide()
      nock(GUIDANCE_API_BASE_URL)
        .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
        .post(`/users/${USER_ID}/recently-opened`).reply(statusCodes.HTTP_STATUS_SERVICE_UNAVAILABLE)

      const { statusCode, payload } = await get(GUIDE_URL)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(pageOf(payload).getByRole('heading', { level: 1, name: 'Claiming the SFI payment' })).toBeInTheDocument()
    })
  })

  describe('the contents', () => {
    test('lists each section\'s subheadings beneath it', async () => {
      mockGuide()

      const contents = within((await guideAt()).getByRole('navigation', { name: 'Contents' }))

      expect(within(contents.getByRole('list')).getByRole('link', { name: 'Before you begin' })).toHaveAttribute('href', '#before-you-begin')
    })

    test('links a subheading on another page to that page', async () => {
      mockGuide({ markdown: '## One\n\ntext\n\n## Two\n\n### 2.1 Deep\n\ntext' })

      const contents = within((await guideInStepperAt()).getByRole('navigation', { name: 'Contents' }))

      expect(contents.getByRole('link', { name: '2.1 Deep' })).toHaveAttribute('href', `${GUIDE_URL}?section=two#21-deep`)
    })
  })

  describe('the page shell', () => {
    test('runs the full width, the shell holding the reading column', async () => {
      mockGuide()

      const page = await guideAt()
      const shell = page.document.querySelector('main .app-shell')

      expect(within(page.document.body).getByRole('contentinfo').firstElementChild).toHaveClass('app-width-container--bleed')
      expect(page.document.querySelector('main')).toHaveClass('app-main-wrapper--bleed')
      expect(shell).toHaveClass('app-shell')
      expect(shell.querySelector('.app-shell__main')).toContainElement(page.getByRole('heading', { level: 1 }))
    })

    test('keeps the contents a direct child of the reading column, where it can stick', async () => {
      mockGuide()

      const contents = (await guideAt()).getByRole('navigation', { name: 'Contents' })

      expect(contents.closest('.app-guide-contents').parentElement).toHaveClass('app-guide-reading', 'app-guide-reading--standard')
    })
  })

  describe('the page banner', () => {
    test('is the side navigation, in place of the header', async () => {
      mockGuide()

      const page = await guideAt()

      expect(sideNavOf(page).getByRole('button', { name: 'Collapse navigation' })).toBeInTheDocument()
      expect(within(page.document.body).queryByRole('banner')).not.toBeInTheDocument()
    })
  })

  describe('POST /guides/reading-width', () => {
    let kept

    beforeEach(() => {
      kept = keepPreferencesInTheApi()
    })

    async function choose (width, returnTo = `${GUIDE_URL}?section=assign-case`) {
      const response = await server.inject({
        method: 'POST',
        url: '/guides/reading-width',
        headers: { cookie },
        payload: { width, returnTo }
      })

      return { response, cookie: mergeCookies(cookie, response.headers['set-cookie']) }
    }

    test('keeps the width as the user\'s preference and goes back to the page', async () => {
      const { response, cookie: updated } = await choose('wide')

      expect(kept).toEqual({ readingWidth: 'wide' })
      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe(`${GUIDE_URL}?section=assign-case`)

      mockGuide()
      const page = await guideAt(GUIDE_URL, { cookie: updated })
      const widths = within(page.getByRole('group', { name: 'Page width' }))

      expect(page.getByRole('heading', { level: 1 }).closest('.app-guide-reading')).toHaveClass('app-guide-reading--wide')
      expect(widths.getByRole('button', { name: 'Wide' })).toHaveAttribute('aria-pressed', 'true')
      expect(widths.getByRole('button', { name: 'Standard' })).toHaveAttribute('aria-pressed', 'false')
    })

    test('does not go to another site', async () => {
      const { response } = await choose('full', 'https://evil.example')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/hub')
    })

    test('refuses a width that is not offered', async () => {
      const { response } = await choose('huge')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })
  })

  describe('GET /guides/{guideId}/assets/{name}', () => {
    test('serves the image with the API\'s type and caching', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .get(`/guides/${GUIDE_ID}/assets/abc123.png`)
        .reply(statusCodes.HTTP_STATUS_OK, Buffer.from([137, 80, 78, 71]), {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, max-age=31536000, immutable'
        })

      const response = await get(`${GUIDE_URL}/assets/abc123.png`)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(response.headers['content-type']).toContain('image/png')
      expect(response.headers['cache-control']).toBe('private, max-age=31536000, immutable')
      expect([...response.rawPayload]).toEqual([137, 80, 78, 71])
    })

    test('is not found when the API has no such asset', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .get(`/guides/${GUIDE_ID}/assets/abc123.png`)
        .reply(statusCodes.HTTP_STATUS_NOT_FOUND)

      const { statusCode } = await get(`${GUIDE_URL}/assets/abc123.png`)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })

    test.each([['..%2Fsecret.png'], ['no-extension'], ['a.b.c']])('is not found, without asking the API, for the name %s', async (name) => {
      const { statusCode } = await get(`${GUIDE_URL}/assets/${name}`)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })
  })

  describe('when not logged in', () => {
    test.each([
      ['GET', GUIDE_URL],
      ['GET', `${GUIDE_URL}/assets/abc123.png`],
      ['POST', '/guides/reading-width']
    ])('redirects %s %s to the home page', async (method, url) => {
      const { statusCode, headers } = await server.inject({ method, url })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')
    })
  })
})
