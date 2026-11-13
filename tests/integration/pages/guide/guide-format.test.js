import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guideResponse } from '../../../fixtures/guidance-api.js'
import { mergeCookies } from '../../helpers/cookies.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf } from '../../helpers/page.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const GUIDE_URL = `/guides/${GUIDE_ID}`
const SECTIONS = ['Introduction', 'Assign case', 'Close case']
const MARKDOWN = [
  '# Claiming the SFI payment',
  '',
  '## Introduction',
  '',
  'Start here, then go to [2 Assign case](#assign-case).',
  '',
  '## Assign case',
  '',
  'Assign it.',
  '',
  '## Close case',
  '',
  'Close it.'
].join('\n')

describe('A guide\'s format', () => {
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
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  async function guidePage (url = GUIDE_URL, cookieToSend = cookie) {
    nock(GUIDANCE_API_BASE_URL)
      .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID }))
      .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })

    const { payload } = await server.inject({ method: 'GET', url, headers: { cookie: cookieToSend } })

    return pageOf(payload)
  }

  function chooseFormat (format, returnTo, cookieToSend = cookie) {
    return server.inject({
      method: 'POST',
      url: '/guides/format',
      headers: { cookie: cookieToSend },
      payload: { format, returnTo }
    })
  }

  function formatsOf (page) {
    return within(page.getByRole('group', { name: 'Guide format' }))
  }

  describe('as a guide opens', () => {
    test('is the whole guide: every section shown, without page numbers or Previous and Next', async () => {
      const page = await guidePage()

      for (const name of SECTIONS) {
        expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
      }
      expect(page.getByText('Close it.')).toBeVisible()
      expect(page.queryByText(/^Page \d of \d$/)).not.toBeInTheDocument()
      expect(page.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
    })

    test('hands every section to the viewer', async () => {
      const page = await guidePage()

      expect(page.document.querySelectorAll('[data-tiptap-markdown]')).toHaveLength(SECTIONS.length)
    })

    test('links the contents to each section on the page, marking none as current', async () => {
      const contents = within((await guidePage()).getByRole('navigation', { name: 'Contents' }))

      expect(contents.getByRole('link', { name: 'Introduction' })).toHaveAttribute('href', '#introduction')
      expect(contents.getByRole('link', { name: 'Assign case' })).toHaveAttribute('href', '#assign-case')
      expect(contents.getByRole('link', { name: 'Close case' })).toHaveAttribute('href', '#close-case')
      expect(contents.queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
    })

    test('leaves the guide\'s own links to its sections to scroll the page', async () => {
      const page = await guidePage()

      expect(page.getByRole('link', { name: '2 Assign case' })).toHaveAttribute('href', '#assign-case')
    })

    test('offers the stepper, to come back to the page and heading the address names', async () => {
      const formats = formatsOf(await guidePage(`${GUIDE_URL}?section=assign-case`))
      const stepper = formats.getByRole('button', { name: 'Stepper', pressed: false })

      expect(formats.getByRole('button', { name: 'Traditional', pressed: true })).toBeInTheDocument()
      expect(stepper.form).toHaveAttribute('action', '/guides/format')
      expect(stepper.form).toHaveAttribute('method', 'post')
      expect(stepper.form).toHaveFormValues({ returnTo: `${GUIDE_URL}?section=assign-case#assign-case` })
    })

    test('has Back to the hub above the reading column, outside the contents pane', async () => {
      const page = await guidePage()
      const pane = page.document.getElementById(page.getByLabelText('Resize contents').getAttribute('aria-controls'))
      const back = page.getByRole('link', { name: 'Back' })

      expect(back).toHaveAttribute('href', '/hub')
      expect(pane).not.toContainElement(back)
    })

    test('tells the script that follows the reader the format, and the heading each contents entry goes to', async () => {
      const page = await guidePage()
      const contents = within(page.getByRole('navigation', { name: 'Contents' }))

      expect(page.document.getElementById('guide-contents')).toHaveAttribute('data-guide-format', 'traditional')
      expect(contents.getByRole('link', { name: 'Assign case' })).toHaveAttribute('data-guide-contents-target', 'assign-case')
    })

    test('sits at the top of the contents pane, above the contents list', async () => {
      const page = await guidePage()
      const pane = page.document.getElementById(page.getByLabelText('Resize contents').getAttribute('aria-controls'))
      const formats = page.getByRole('group', { name: 'Guide format' })
      const contents = page.getByRole('navigation', { name: 'Contents' })

      expect(pane).toContainElement(formats)
      expect(pane).toContainElement(contents)
      expect(formats.compareDocumentPosition(contents) & page.document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  describe('when the reader chooses the stepper', () => {
    test('goes back to their place, now a section at a time, and stays chosen', async () => {
      const place = `${GUIDE_URL}?section=assign-case#assign-case`
      const response = await chooseFormat('stepper', place)
      const page = await guidePage(`${GUIDE_URL}?section=assign-case`, mergeCookies(cookie, response.headers['set-cookie']))

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe(place)
      expect(page.getByText('Page 2 of 3')).toBeVisible()
      expect(page.getByRole('heading', { level: 2, name: 'Assign case' })).toBeVisible()
      expect(page.getByRole('heading', { level: 2, name: 'Close case', hidden: true })).not.toBeVisible()
      expect(formatsOf(page).getByRole('button', { name: 'Stepper', pressed: true })).toBeInTheDocument()
    })
  })

  describe('in the stepper', () => {
    test('says "Previous page" and "Next page" in full on its links either side, each with its section\'s title', async () => {
      const response = await chooseFormat('stepper', GUIDE_URL)
      const page = await guidePage(`${GUIDE_URL}?section=assign-case`, mergeCookies(cookie, response.headers['set-cookie']))
      const either = within(page.getByRole('navigation', { name: 'Pagination' }))

      for (const [words, section] of [['Previous page', 'Introduction'], ['Next page', 'Close case']]) {
        const link = either.getByRole('link', { name: new RegExp(`^${words}`) })
        const title = within(link).getByText(words)

        expect(link).toHaveTextContent(section)
        // GOV.UK's own wording hides "page" from sight.
        expect(title.querySelector('.govuk-visually-hidden')).toBeNull()
      }
    })
  })

  describe('a choice of format', () => {
    test('goes back to the hub rather than to another site', async () => {
      const response = await chooseFormat('traditional', 'https://evil.example')

      expect(response.headers.location).toBe('/hub')
    })

    test('is refused when it is not one offered', async () => {
      const response = await chooseFormat('scroll', GUIDE_URL)

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    })

    test('sends a user who is not signed in to the home page', async () => {
      const response = await server.inject({ method: 'POST', url: '/guides/format', payload: { format: 'stepper', returnTo: GUIDE_URL } })

      expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
      expect(response.headers.location).toBe('/')
    })
  })
})
