import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { HubViewModel } from '../../../../src/pages/hub/view-models.js'
import { guidePageResponse, guideSummaryResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')

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
    test('Should respond with 200 and render the hub page with its 4 tabs', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/hub',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('RPA Guidance hub')
      expect(payload).toContain('Recently opened (0)')
      expect(payload).toContain('Pinned (0)')
      expect(payload).toContain('Bookmarked guides (0)')
      expect(payload).toContain('href="#pinned"')
      expect(payload).toContain('href="#bookmarked-guides"')
      expect(payload).not.toContain('Editing')
      expect(payload).not.toContain('Saved guidance')
      expect(payload).toContain('All guides (1)')
      expect(payload).toContain('href="#all-guides"')
      expect(payload).toContain('Upload guidance')
      expect(payload).toContain('You haven&#39;t opened any guidance yet.')
      expect(payload).not.toContain('defra-service-navigation')
      expect(payload).toContain('class="govuk-tabs" data-module="govuk-tabs"')
      expect(payload).toContain('href="#recently-opened"')
    })

    test('lists everyone\'s guides in tabs, all guides first, in the side navigation\'s order', async () => {
      const cookie = await loginAsDevUser(server)

      const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

      const order = ['All guides (', 'Recently opened (', 'Pinned (', 'Bookmarked guides ('].map((label) => payload.indexOf(label))
      expect(order).toEqual([...order].sort((a, b) => a - b))
      expect(order).not.toContain(-1)
      expect(payload).not.toContain('href="#awaiting-my-review"')
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

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ recentlyOpened: items }))

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

      const renderedHtml = await server.render('hub/page.njk', new HubViewModel({ recentlyOpened: items }))

      expect(renderedHtml).not.toContain('javascript:alert')
      expect(renderedHtml).not.toContain('evil.example.com')
      expect(renderedHtml).toContain('href="#"')
    })
  })

  describe('the All guides tab', () => {
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

      expect(payload).toContain('All guides (0)')
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
