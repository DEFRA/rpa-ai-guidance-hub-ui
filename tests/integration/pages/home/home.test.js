import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'

import { createServer } from '../../../../src/server/server.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf } from '../../helpers/page.js'

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

      return pageOf(payload)
    }

    test('has the design\'s green hero, with a white start button and a panel of what the hub does', async () => {
      const page = await signInPage()

      expect(page.document.querySelector('.app-sign-in-hero')).toBeInTheDocument()
      expect(page.getByText('Rural Payments Agency')).toHaveClass('app-sign-in-hero__caption')
      expect(page.getByRole('button', { name: 'Sign in' })).toHaveAttribute('href', '/login')
      expect(page.getByRole('button', { name: 'Sign in' })).toHaveClass('govuk-button--start', 'app-sign-in-hero__start-button')
      expect(page.getByRole('heading', { name: 'What you can do in the hub' }).parentElement).toHaveClass('app-sign-in-hero__panel')
    })

    test('is titled Guidance hub', async () => {
      const page = await signInPage()

      expect(page.getByRole('heading', { level: 1, name: 'Guidance hub' })).toHaveClass('app-sign-in-hero__title')
    })

    test('has a header with only the Defra logo, so the hero is the one place to sign in', async () => {
      const page = await signInPage()

      const header = within(page.document.body).getByRole('banner')
      expect(header.querySelector('.defra-header__logo')).toBeInTheDocument()
      expect(header.querySelector('.defra-header__service-name')).not.toBeInTheDocument()
      expect(within(header).queryByText('Sign in')).not.toBeInTheDocument()
      expect(page.document.querySelectorAll('a[href="/login"]')).toHaveLength(1)
    })

    test('says what to do if you cannot sign in', async () => {
      const page = await signInPage()

      expect(page.getByRole('heading', { name: 'If you cannot sign in' })).toBeInTheDocument()
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
