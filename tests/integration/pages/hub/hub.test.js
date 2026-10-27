import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { HubViewModel } from '../../../../src/pages/hub/view-models.js'
import { guidePageResponse, guideSummaryResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const LIST_HEADING = '<h2 class="govuk-heading-m">'

/** The headings of the lists that the page's main area shows. */
function listHeadings (main) {
  return main.split(LIST_HEADING).slice(1).map((rest) => rest.slice(0, rest.indexOf('</h2>')))
}

describe('#hubController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(() => {
    nock(GUIDANCE_API_BASE_URL).get('/guides').reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
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

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('RPA Guidance hub')
      expect(payload).toContain('<h2 class="govuk-heading-m">All guides</h2>')
      expect(payload).not.toContain('Editing')
      expect(payload).not.toContain('Saved guidance')
      expect(payload).not.toContain('defra-service-navigation')
    })

    test('shows one list at a time, not tabs', async () => {
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      expect(main).not.toContain('govuk-tabs')
      expect(listHeadings(main)).toEqual(['All guides'])
    })

    test('leaves a designer\'s work to the side navigation', async () => {
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      expect(main).not.toContain('Designing')
      expect(main).not.toContain('Upload guidance')
      expect(main).not.toContain('Awaiting my review')
    })

    test('Should escape HTML in guidance items to prevent XSS vulnerabilities', async () => {
      const xssTitle = '<script>alert("xss")</script>'
      const items = [
        {
          title: xssTitle,
          href: '/guidance/xss',
          lastModified: '23 September 2026',
          version: '1',
          removeHref: '/hub/remove/xss'
        }
      ]

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ recentlyOpened: items, shown: 'recentlyOpened' }))

      expect(renderedHtml).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(renderedHtml).not.toContain(xssTitle)
      expect(renderedHtml).toContain('class="govuk-table"')
    })

    test('Should not render a javascript: href from a guidance item', async () => {
      const items = [
        {
          title: 'Untrusted href',
          href: 'javascript:alert(document.cookie)',
          lastModified: '23 September 2026',
          version: '1',
          removeHref: '//evil.example.com'
        }
      ]

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ recentlyOpened: items, shown: 'recentlyOpened' }))

      expect(renderedHtml).not.toContain('javascript:alert')
      expect(renderedHtml).not.toContain('evil.example.com')
      expect(renderedHtml).toContain('href="#"')
    })
  })

  describe('a list of guides', () => {
    test.each([
      ['/hub/recently-opened', 'Recently opened', 'You haven&#39;t opened any guidance yet.'],
      ['/hub/pinned', 'Pinned', 'You haven&#39;t pinned any guidance yet.'],
      ['/hub/bookmarked-guides', 'Bookmarked guides', 'You haven&#39;t bookmarked any guidance yet.'],
      ['/hub/awaiting-my-review', 'Awaiting my review', 'There is no guidance awaiting your review.']
    ])('%s shows only the %s list', async (url, heading, emptyMessage) => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({ method: 'GET', url, headers: { cookie } })

      const main = payload.slice(payload.indexOf('<main'), payload.indexOf('</main>'))
      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(listHeadings(main)).toEqual([heading])
      expect(main).toContain(emptyMessage)
      expect(main).not.toContain('govuk-tabs')
    })

    test.each([
      ['/hub/recently-opened'],
      ['/hub/pinned'],
      ['/hub/bookmarked-guides'],
      ['/hub/awaiting-my-review']
    ])('%s does not ask the API for the guides', async (url) => {
      nock.cleanAll()
      const guides = nock(GUIDANCE_API_BASE_URL).get('/guides').reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
      const cookie = await loginAsDevUser(server)

      await server.inject({ method: 'GET', url, headers: { cookie } })

      expect(guides.isDone()).toBe(false)
    })

    test('is not found when there is no such list', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({ method: 'GET', url: '/hub/no-such-list', headers: { cookie } })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_NOT_FOUND)
    })
  })

  describe('the All guides list', () => {
    test('Should list each guide, linking to it', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({
        items: [guideSummaryResponse({ id: '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90' })]
      }))
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(payload).toContain('href="/guides/0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90"')
      expect(payload).toContain('Claiming the SFI payment')
      expect(payload).toContain('6 October 2026')
      expect(payload).toContain('owner@example.com')
    })

    test('Should say there are no guides when there are none', async () => {
      nock.cleanAll()
      nock(GUIDANCE_API_BASE_URL).get('/guides').reply(statusCodes.HTTP_STATUS_OK, guidePageResponse({ items: [] }))
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      expect(payload).toContain('There are no guides yet.')
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
})
