import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guideResponse } from '../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../helpers/cookies.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf } from '../../helpers/page.js'
import { keepPreferencesInTheApi } from '../../helpers/preferences-api.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const GUIDE_URL = `/guides/${GUIDE_ID}`
const MARKDOWN = '# Claiming the SFI payment\n\n## Introduction\n\nStart here.\n\n## Close case\n\nClose it.'

describe('A guide\'s information', () => {
  let server, cookie, kept

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(async () => {
    kept = keepPreferencesInTheApi()
    cookie = await loginAsDevUser(server)
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  async function guidePage (cookieToSend = cookie) {
    nock(GUIDANCE_API_BASE_URL)
      .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID }))
      .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })

    const { payload } = await server.inject({ method: 'GET', url: GUIDE_URL, headers: { cookie: cookieToSend } })

    return pageOf(payload)
  }

  function choose (shown, returnTo = GUIDE_URL, cookieToSend = cookie) {
    return server.inject({ method: 'POST', url: '/guides/information', headers: { cookie: cookieToSend }, payload: { shown, returnTo } })
  }

  async function guidePageAfter (...choices) {
    let kept = cookie

    for (const shown of choices) {
      const response = await choose(shown, GUIDE_URL, kept)
      kept = mergeCookies(kept, response.headers['set-cookie'])
    }

    return guidePage(kept)
  }

  const buttonOf = page => page.getByRole('button', { name: 'Guide information' })
  const informationOf = page => page.document.getElementById(buttonOf(page).getAttribute('aria-controls'))

  test('has a button beside the title, saying it shows the information, which is hidden at first', async () => {
    const page = await guidePage()
    const button = buttonOf(page)

    expect(page.getByRole('heading', { level: 1 }).parentElement).toContainElement(button)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(within(button).getByText('Show guide information')).toBeInTheDocument()
    expect(informationOf(page)).not.toBeVisible()
  })

  test('without JavaScript, sends the choice to show the information, then comes back to the page', async () => {
    const { form } = buttonOf(await guidePage())

    expect(form).toHaveAttribute('action', '/guides/information')
    expect(form).toHaveAttribute('method', 'post')
    expect(form).toHaveFormValues({ shown: 'true', returnTo: GUIDE_URL })
  })

  test('once shown, is shown on every guide, with its rows in order, until the user hides it', async () => {
    const page = await guidePageAfter(true)
    const button = buttonOf(page)
    const information = within(informationOf(page))

    expect(informationOf(page)).toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(within(button).getByText('Hide guide information')).toBeInTheDocument()
    expect(button.form).toHaveFormValues({ shown: 'false' })
    expect(information.getAllByRole('term').map(term => term.textContent)).toEqual([
      'Last modified date', 'Scheme', 'Scheme year', 'Owner email', 'Purpose of guidance',
      'Required knowledge and training', 'Systems', 'Who is this guidance for?'
    ])
    expect(information.getByRole('link', { name: 'owner@example.com' })).toHaveAttribute('href', 'mailto:owner%40example.com')
    expect(information.getAllByText('Not provided')).not.toHaveLength(0)
  })

  test('is hidden again once the user hides it', async () => {
    expect(informationOf(await guidePageAfter(true, false))).not.toBeVisible()
  })

  test('is kept as the user\'s preference, so it follows them to their next sign-in', async () => {
    await choose(true)
    const page = await guidePage(await loginAsDevUser(server))

    expect(kept).toEqual({ guideInformationShown: true })
    expect(informationOf(page)).toBeVisible()
  })

  describe('a choice to show or hide it', () => {
    test('goes back to the page it was made on', async () => {
      const response = await choose(true, `${GUIDE_URL}?section=close-case`)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe(`${GUIDE_URL}?section=close-case`)
    })

    test('goes back to the hub rather than to another site', async () => {
      const response = await choose(true, 'https://evil.example')

      expect(response.headers.location).toBe('/hub')
    })

    test('is refused when it is not true or false', async () => {
      const response = await choose('maybe')

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('sends a user who is not signed in to the home page', async () => {
      const response = await server.inject({ method: 'POST', url: '/guides/information', payload: { shown: true, returnTo: GUIDE_URL } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/')
    })
  })
})
