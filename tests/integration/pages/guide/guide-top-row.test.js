import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guideResponse, userResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf } from '../../helpers/page.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const GUIDE_URL = `/guides/${GUIDE_ID}`
const MARKDOWN = '# Claiming the SFI payment\n\n## Introduction\n\nStart here.\n\n## Close case\n\nClose it.'

describe('A guide\'s top row', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  async function guidePage () {
    const { id: userId } = userResponse()
    nock(GUIDANCE_API_BASE_URL)
      .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID }))
      .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })
      .post('/users').reply(statusCodes.HTTP_STATUS_CREATED, userResponse())
      .get(`/users/${userId}`).reply(statusCodes.HTTP_STATUS_OK, userResponse({ pinned: [] }))

    const { payload } = await server.inject({ method: 'GET', url: GUIDE_URL, headers: { cookie: await loginAsDevUser(server) } })

    return pageOf(payload)
  }

  /**
   * @param {Document} document
   * @param {Element} first
   * @param {Element} second
   * @returns {boolean} Whether `first` comes before `second` on the page
   */
  function isBefore (document, first, second) {
    return Boolean(first.compareDocumentPosition(second) & document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING)
  }

  test('has the tags, the updated date, Pin guide and the page width together, in that order, above the title', async () => {
    const page = await guidePage()
    const live = page.getByText('Live')
    const updated = page.getByText(/^Updated /)
    const pin = page.getByRole('button', { name: 'Pin guide' })
    const widths = page.getByRole('group', { name: 'Page width' })
    const title = page.getByRole('heading', { level: 1 })
    const row = pin.form.parentElement

    for (const part of [live, updated, widths]) {
      expect(row).toContainElement(part)
    }
    expect(isBefore(page.document, live, updated)).toBe(true)
    expect(isBefore(page.document, updated, pin)).toBe(true)
    expect(isBefore(page.document, pin, widths)).toBe(true)
    expect(isBefore(page.document, row, title)).toBe(true)
  })

  test('has Back first, before Pin guide, the page width, the title and the contents, so the tab order follows the page', async () => {
    const page = await guidePage()
    const back = page.getByRole('link', { name: 'Back' })
    const pin = page.getByRole('button', { name: 'Pin guide' })
    const widths = page.getByRole('group', { name: 'Page width' })
    const title = page.getByRole('heading', { level: 1 })
    const format = page.getByRole('group', { name: 'Guide format' })

    for (const later of [pin, widths, title, format]) {
      expect(isBefore(page.document, back, later)).toBe(true)
    }
  })

  test('shows a label for each group of buttons, which names the group', async () => {
    const page = await guidePage()

    for (const name of ['Page width', 'Guide format']) {
      const label = page.getByText(name, { selector: '.app-guide-reading-width__label' })

      expect(label).not.toHaveClass('govuk-visually-hidden')
      expect(page.getByRole('group', { name })).toHaveAttribute('aria-labelledby', label.id)
    }
  })
})
