import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../src/server/server.js'
import { HubViewModel } from '../../../../src/pages/hub/view-models.js'
import { loginAsDevUser } from '../../helpers/login.js'

describe('#hubController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('When logged in as a dev user', () => {
    test('Should respond with 200 and render the hub page with the 4 tabs and action button', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode, payload } = await server.inject({
        method: 'GET',
        url: '/hub',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
      expect(payload).toContain('RPA Guidance hub')
      expect(payload).toContain('Recently opened (0)')
      expect(payload).toContain('Saved guidance (0)')
      expect(payload).toContain('Editing (0)')
      expect(payload).toContain('Awaiting approval (0)')
      expect(payload).not.toContain('All guidance')
      expect(payload).toContain('Upload guidance')
      expect(payload).toContain('You haven&#39;t opened any guidance yet.')
      expect(payload).not.toContain('defra-service-navigation')
      expect(payload).toContain('class="govuk-tabs" data-module="govuk-tabs"')
      expect(payload).toContain('href="#recently-opened"')
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
