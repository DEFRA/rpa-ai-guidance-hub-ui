import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guideResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { pageOf } from '../../helpers/page.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const MARKDOWN = '# Claiming the SFI payment\n\n## Introduction\n\nStart here.\n\n## Close case\n\nClose it.'
// The handle is hidden until the script that moves it attaches, and a hidden
// element has no accessible name, so it is found by its label.
const RESIZE_HANDLE = 'Resize contents'

describe('Resizing a guide\'s contents column', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(() => {
    nock(GUIDANCE_API_BASE_URL)
      .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID }))
      .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, MARKDOWN, { 'Content-Type': 'text/plain' })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  test('is a handle on the contents column\'s edge, from 240 to 560 pixels wide and 340 at first, hidden until the script can move it', async () => {
    const cookie = await loginAsDevUser(server)
    const { payload } = await server.inject({ method: 'GET', url: `/guides/${GUIDE_ID}`, headers: { cookie } })
    const page = pageOf(payload)

    const handle = page.getByLabelText(RESIZE_HANDLE)
    const contents = page.getByRole('navigation', { name: 'Contents' })

    expect(handle).toHaveRole('separator')
    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('aria-controls', contents.id)
    expect(within(contents).getByRole('link', { name: 'Introduction' })).toBeInTheDocument()
    expect(handle).toHaveAttribute('aria-valuemin', '240')
    expect(handle).toHaveAttribute('aria-valuemax', '560')
    expect(handle).toHaveAttribute('aria-valuenow', '340')
    expect(handle).toHaveAttribute('aria-valuetext', '340 pixels wide')
    expect(handle).toHaveAttribute('data-default-width', '340')
    expect(handle).toHaveAttribute('tabindex', '0')
    expect(handle).not.toBeVisible()
  })

  test('is not confused with a heading called "Guide contents" or "App layout nav"', async () => {
    nock.cleanAll()
    nock(GUIDANCE_API_BASE_URL)
      .get(`/guides/${GUIDE_ID}`).reply(statusCodes.HTTP_STATUS_OK, guideResponse({ id: GUIDE_ID }))
      .get(`/guides/${GUIDE_ID}/content`).reply(statusCodes.HTTP_STATUS_OK, '# Claiming\n\n## Guide contents\n\nHere.\n\n## App layout nav\n\nThere.', { 'Content-Type': 'text/plain' })
    const cookie = await loginAsDevUser(server)
    const { payload } = await server.inject({ method: 'GET', url: `/guides/${GUIDE_ID}`, headers: { cookie } })
    const page = pageOf(payload)

    const controlled = page.getByLabelText(RESIZE_HANDLE).getAttribute('aria-controls')

    expect(page.getByRole('navigation', { name: 'Contents' })).toHaveAttribute('id', controlled)
    expect(page.document.querySelector('[id="guide-contents"]').textContent).toBe('Guide contents')
    expect(page.document.querySelector('[id="app-layout-nav"]').textContent).toBe('App layout nav')
    expect(page.document.querySelectorAll('[id="app-layout-nav"]')).toHaveLength(1)
    expect(page.document.querySelectorAll('[id="guide-contents"]')).toHaveLength(1)
  })
})
