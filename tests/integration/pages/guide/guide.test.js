import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guideResponse } from '../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../helpers/cookies.js'
import { loginAsDevUser } from '../../helpers/login.js'

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
    await server.stop({ timeout: 0 })
  })

  function get (url) {
    return server.inject({ method: 'GET', url, headers: { cookie } })
  }

  describe('GET /guides/{guideId}', () => {
    test('Should show the title as the one main heading, with its version, Live tag and date', async () => {
      mockGuide()

      const { statusCode, payload } = await get(GUIDE_URL)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload.match(/<h1[ >]/g)).toHaveLength(1)
      expect(payload).toMatch(/<h1[^>]*>\s*Claiming the SFI payment\s*<\/h1>/)
      expect(payload).toContain('Version 1')
      expect(payload).toContain('Live')
      expect(payload).toContain('Updated 6 October 2026')
    })

    test('Should show how far through each page of the guide the reader is, without an inline style', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain('app-progress__track app-guide-progress')
      expect(payload).toMatch(/#guide-progress-bar-1 \{\s*--progress-width: 33%;/)
      expect(payload).toMatch(/#guide-progress-bar-3 \{\s*--progress-width: 100%;/)
      expect(payload).not.toMatch(/style="[^"]*width/)
    })

    test('Should show the section being read, and where the reader is', async () => {
      mockGuide()

      const { payload } = await get(`${GUIDE_URL}?page=2`)

      expect(payload).toContain('Page 2 of 3')
      expect(payload).toMatch(/<div class="app-guide-page" data-guide-page="2">/)
    })

    test('Should keep the other sections for find-in-page, hidden until it finds a match', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toMatch(/<div class="app-guide-page" data-guide-page="1">/)
      expect(payload).toContain('data-guide-page="2" hidden="until-found"')
      expect(payload).toContain('data-guide-page="3" hidden="until-found"')
      expect(payload).toContain('Assign it.')
      expect(payload).toContain('Close it.')
    })

    test('Should give only the section being read to the viewer', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload.match(/data-tiptap-markdown/g)).toHaveLength(1)
      expect(payload.match(/<script type="application\/json">/g)).toHaveLength(1)
      expect(payload).not.toContain('"Assign it."')
    })

    test('Should list every section in the contents, linking to each', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain('aria-labelledby="guide-contents-heading"')
      expect(payload).toContain(`href="${GUIDE_URL}?page=1" aria-current="page">Introduction`)
      expect(payload).toContain(`href="${GUIDE_URL}?page=2">Assign case`)
      expect(payload).toContain(`href="${GUIDE_URL}?page=3">Close case`)
      expect(payload).toContain('data-guide-contents-page="2"')
    })

    test('Should name the section a Next or Previous link goes to', async () => {
      mockGuide()

      const { payload } = await get(`${GUIDE_URL}?page=2`)

      expect(payload).toContain('Page 2 of 3')
      expect(payload).toMatch(/govuk-pagination__link-label[^>]*>Introduction</)
      expect(payload).toMatch(/govuk-pagination__link-label[^>]*>Close case</)
    })

    test('Should have no Previous link on the first page and no Next link on the last', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)
      const [first, , last] = payload.split('data-guide-page=').slice(1)

      expect(first).not.toContain('govuk-pagination__prev')
      expect(first).toContain('govuk-pagination__next')
      expect(last).toContain('govuk-pagination__prev')
      expect(last).not.toContain('govuk-pagination__next')
    })

    test('Should render the section as a fallback and for the viewer, its images served by the app', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain('data-tiptap-markdown')
      expect(payload).toContain('<script type="application/json">')
      expect(payload).toContain('<h3 id="before-you-begin">Before you begin</h3>')
      expect(payload).toContain(`<img src="${GUIDE_URL}/assets/abc123.png"`)
    })

    test('Should colour the parts of a note to fill in without the viewer, by class and not by style', async () => {
      mockGuide({ markdown: '## Section\n\nComplete the parts in [red]{.red}.\n\n> Version used:[&lt;version&gt;]{.red}' })

      const { payload } = await get(GUIDE_URL)
      const fallback = payload.slice(payload.indexOf('app-guide-markdown__fallback'))

      expect(fallback).toContain('<span class="markdown-preview__text--red">red</span>')
      expect(fallback).toContain('<span class="markdown-preview__text--red">&lt;version&gt;</span>')
      expect(fallback).not.toContain('{.red}')
      expect(fallback).not.toMatch(/<span[^>]*style=/)
    })

    test('Should take a link to another section to the page that has it, and leave one to this page', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain(`<a href="${GUIDE_URL}?page=2#assign-case">2 Assign case</a>`)
      expect(payload).toContain('<a href="#before-you-begin">Before you begin</a>')
      expect(payload).toMatch(/<h2[^>]*id="introduction"/)
      expect(payload).toContain('data-heading-ids="[&quot;before-you-begin&quot;]"')
    })

    test('Should describe the guide, with its owner as a link', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain('About this guide')
      expect(payload).toContain('Sustainable Farming Incentive (SFI)')
      expect(payload).toContain('Processor')
      expect(payload).toContain('CRM')
      expect(payload).toContain('href="mailto:owner@example.com"')
    })

    test('Should not offer to change the guide', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).not.toContain('<textarea')
      expect(payload).not.toContain('contenteditable="true"')
      expect(payload).not.toContain('data-tiptap-editable')
    })

    test('Should go back to the hub', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toMatch(/<a[^>]*href="\/hub"[^>]*govuk-back-link|<a[^>]*govuk-back-link[^>]*href="\/hub"/)
    })

    test('Should escape a hostile title, owner and Markdown', async () => {
      const hostile = guideResponse({
        id: GUIDE_ID,
        metadata: { guideTitle: '<img src=x onerror=alert(1)>', owner: '"><script>alert(1)</script>' },
        versions: [{ ...guideResponse().versions[0], title: '<script>alert("title")</script>' }]
      })
      mockGuide({
        guide: hostile,
        markdown: '## Section\n\n<script>alert("body")</script>\n\n[x](javascript:alert(1))'
      })

      const { payload } = await get(GUIDE_URL)

      expect(payload).not.toContain('<script>alert')
      expect(payload).not.toContain('<img src=x')
      expect(payload).not.toMatch(/href="javascript:/)
      expect(payload).toContain('&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;')
    })

    test('Should not let Markdown close the script element carrying it', async () => {
      mockGuide({ markdown: '## Section\n\n</script><script>alert(1)</script>' })

      const { payload } = await get(GUIDE_URL)

      expect(payload).not.toContain('</script><script>alert(1)')
    })

    test('Should say the guide is not found when the API has none', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_NOT_FOUND)
        .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_NOT_FOUND)

      const { statusCode, payload } = await get(GUIDE_URL)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
      expect(payload).toContain('Page not found')
    })

    test('Should say the guide is not found for an address that cannot be a guide', async () => {
      const { statusCode } = await get('/guides/not-a-guide')

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })

    test('Should make the viewer script available to the page', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toMatch(/<script type="module" src="[^"]*tiptap[^"]*"/)
    })
  })

  describe('the contents', () => {
    test('Should list each section\'s subheadings beneath it', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toMatch(/app-guide-contents__list[\s\S]*href="#before-you-begin">Before you begin/)
    })

    test('Should link a subheading on another page to that page', async () => {
      mockGuide({ markdown: '## One\n\ntext\n\n## Two\n\n### 2.1 Deep\n\ntext' })

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain(`href="${GUIDE_URL}?page=2#21-deep">2.1 Deep`)
    })
  })

  describe('the page shell', () => {
    test('Should run the full width, with the panel as a column of the shell beside the reading column', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain('app-width-container--bleed')
      expect(payload).toContain('app-main-wrapper--bleed')
      expect(payload).toMatch(/class="app-shell">[\s\S]*class="app-shell__main">[\s\S]*class="app-guide-panel"/)
    })

    test('Should keep the contents a direct child of the reading column, where it can stick', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toMatch(/<div class="app-guide-reading app-guide-reading--standard">[\s\S]*?<\/div>\s*<nav class="app-guide-contents"/)
    })

    test('Should list the guide\'s answers in the panel as the prototype\'s metadata list', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain('app-guide-metadata-list__row')
      expect(payload).toContain('class="app-side-nav__icon-button"')
    })

    test('Should show the collapsed panel as the prototype\'s rail, its button named and with a tooltip', async () => {
      const { cookie: collapsedCookie } = await server.inject({
        method: 'POST',
        url: '/guides/panel-toggle',
        headers: { cookie },
        payload: { collapsed: 'true', returnTo: GUIDE_URL }
      }).then(response => ({ cookie: mergeCookies(cookie, response.headers['set-cookie']) }))
      mockGuide()

      const { payload } = await server.inject({ method: 'GET', url: GUIDE_URL, headers: { cookie: collapsedCookie } })

      expect(payload).toContain('app-side-nav app-side-nav--rail')
      expect(payload).toContain('app-side-nav__rail-item')
      expect(payload).toContain('data-side-nav-tooltip')
      expect(payload).toContain('<span class="app-side-nav__rail-label">Show guide details</span>')
      expect(payload).toContain('<span class="app-side-nav__tooltip" aria-hidden="true">Show guide details</span>')
    })
  })

  describe('the page banner', () => {
    test('Should be full width, with the Defra green beneath it', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain('defra-header defra-header--full-width')
      expect(payload).toContain('defra-header__brand-border')
    })
  })

  describe('the About this guide panel', () => {
    async function togglePanel (collapsed) {
      const response = await server.inject({
        method: 'POST',
        url: '/guides/panel-toggle',
        headers: { cookie },
        payload: { collapsed, returnTo: `${GUIDE_URL}?page=2` }
      })

      return { response, cookie: mergeCookies(cookie, response.headers['set-cookie']) }
    }

    test('Should be open, offering to hide the details', async () => {
      mockGuide()

      const { payload } = await get(GUIDE_URL)

      expect(payload).toContain('id="guide-panel-body"')
      expect(payload).toContain('Hide guide details')
      expect(payload).toMatch(/aria-expanded="true"/)
      expect(payload).not.toContain('app-guide-panel--collapsed')
    })

    test('Should fold away to a rail that offers to show the details, and open again', async () => {
      const { response, cookie: collapsed } = await togglePanel('true')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe(`${GUIDE_URL}?page=2`)

      mockGuide()
      const rail = await server.inject({ method: 'GET', url: GUIDE_URL, headers: { cookie: collapsed } })

      expect(rail.payload).toContain('app-guide-panel--collapsed')
      expect(rail.payload).toContain('Show guide details')
      expect(rail.payload).toMatch(/aria-expanded="false"/)
      expect(rail.payload).not.toContain('id="guide-panel-body"')
      expect(rail.payload).not.toContain('example.com')

      const reopened = await togglePanel('false')
      mockGuide()
      const open = await server.inject({ method: 'GET', url: GUIDE_URL, headers: { cookie: reopened.cookie } })

      expect(open.payload).toContain('id="guide-panel-body"')
    })

    test('Should not go to another site', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/guides/panel-toggle',
        headers: { cookie },
        payload: { collapsed: 'true', returnTo: 'https://evil.example' }
      })

      expect(response.headers.location).toBe('/hub')
    })

    test('Should refuse something that is not true or false', async () => {
      const { response } = await togglePanel('maybe')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })
  })

  describe('POST /guides/reading-width', () => {
    async function choose (width, returnTo = `${GUIDE_URL}?page=2`) {
      const response = await server.inject({
        method: 'POST',
        url: '/guides/reading-width',
        headers: { cookie },
        payload: { width, returnTo }
      })

      return { response, cookie: mergeCookies(cookie, response.headers['set-cookie']) }
    }

    test('Should remember the width and go back to the page', async () => {
      const { response, cookie: updated } = await choose('wide')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe(`${GUIDE_URL}?page=2`)

      mockGuide()
      const { payload } = await server.inject({ method: 'GET', url: GUIDE_URL, headers: { cookie: updated } })

      expect(payload).toContain('app-guide-reading--wide')
      expect(payload).toMatch(/aria-pressed="true">Wide</)
      expect(payload).toMatch(/aria-pressed="false">Standard</)
    })

    test('Should not go to another site', async () => {
      const { response } = await choose('full', 'https://evil.example')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/hub')
    })

    test('Should refuse a width that is not offered', async () => {
      const { response } = await choose('huge')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })
  })

  describe('GET /guides/{guideId}/assets/{name}', () => {
    test('Should serve the image with the API\'s type and caching', async () => {
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

    test('Should be not found when the API has no such asset', async () => {
      nock(GUIDANCE_API_BASE_URL)
        .get(`/guides/${GUIDE_ID}/assets/abc123.png`)
        .reply(statusCodes.HTTP_STATUS_NOT_FOUND)

      const { statusCode } = await get(`${GUIDE_URL}/assets/abc123.png`)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })

    test.each([['..%2Fsecret.png'], ['no-extension'], ['a.b.c']])('Should be not found, without asking the API, for the name %s', async (name) => {
      const { statusCode } = await get(`${GUIDE_URL}/assets/${name}`)

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })
  })

  describe('when not logged in', () => {
    test.each([
      ['GET', GUIDE_URL],
      ['GET', `${GUIDE_URL}/assets/abc123.png`],
      ['POST', '/guides/reading-width'],
      ['POST', '/guides/panel-toggle']
    ])('Should redirect %s %s to the home page', async (method, url) => {
      const { statusCode, headers } = await server.inject({ method, url })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(headers.location).toBe('/')
    })
  })
})
