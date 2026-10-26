import { constants as statusCodes } from 'node:http2'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../helpers/login.js'

describe('#homepageController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server?.stop({ timeout: 0 })
  })

  describe('When not signed in, the sign-in page', () => {
    async function signInPage () {
      const { payload } = await server.inject({ method: 'GET', url: '/' })

      return payload
    }

    test('has the design\'s green hero, with a white start button and a panel of what the hub does', async () => {
      const payload = await signInPage()

      expect(payload).toContain('<div class="app-sign-in-hero">')
      expect(payload).toContain('<p class="app-sign-in-hero__caption">Rural Payments Agency</p>')
      expect(payload).toMatch(/<a href="\/login\/callback" class="govuk-button govuk-button--start app-sign-in-hero__start-button"[^>]*>\s*Sign in/)
      expect(payload).toMatch(/class="app-sign-in-hero__panel"[^]*What you can do in the hub/)
    })

    test('is titled Guidance hub', async () => {
      const payload = await signInPage()

      expect(payload).toContain('<h1 class="govuk-heading-xl app-sign-in-hero__title">Guidance hub</h1>')
    })

    test('has a header with only the Defra logo, so the hero is the one place to sign in', async () => {
      const payload = await signInPage()

      const header = payload.slice(payload.indexOf('<header'), payload.indexOf('</header>'))
      expect(header).toContain('class="defra-header__logo"')
      expect(header).not.toContain('defra-header__service-name')
      expect(header).not.toContain('Sign in')
      expect(payload.split('href="/login/callback"')).toHaveLength(2)
    })

    test('says what to do if you cannot sign in', async () => {
      const payload = await signInPage()

      expect(payload).toContain('If you cannot sign in')
    })
  })

  describe('When logged in as a dev user', () => {
    test('Should respond with 200 and render the home page', async () => {
      const cookie = await loginAsDevUser(server)

      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/',
        headers: { cookie }
      })

      expect(statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    })
  })
})
