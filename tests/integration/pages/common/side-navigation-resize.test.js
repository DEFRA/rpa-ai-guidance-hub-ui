import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { config } from '../../../../src/config/config.js'
import { createServer } from '../../../../src/server/server.js'
import { guidePageResponse, schemesResponse } from '../../../fixtures/guidance-api.js'
import { loginAsDevUser } from '../../helpers/login.js'
import { keepPreferencesInTheApi } from '../../helpers/preferences-api.js'
import { pageOf } from '../../helpers/page.js'

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
// The handle is hidden until the script that moves it attaches, and a hidden
// element has no accessible name, so it is found by its label.
const RESIZE_HANDLE = 'Resize navigation'

describe('Resizing the side navigation', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  beforeEach(() => {
    nock(GUIDANCE_API_BASE_URL).get('/reference/schemes').optionally().reply(statusCodes.HTTP_STATUS_OK, schemesResponse())
    nock(GUIDANCE_API_BASE_URL).get('/guides').query(true).reply(statusCodes.HTTP_STATUS_OK, guidePageResponse())
  })

  afterEach(() => {
    nock.cleanAll()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  async function hubFor (cookie) {
    const { payload } = await server.inject({ method: 'GET', url: '/hub', headers: { cookie } })

    return pageOf(payload)
  }

  test('is a handle on the open navigation\'s edge, from 220 to 440 pixels wide and 280 at first, hidden until the script can move it', async () => {
    const page = await hubFor(await loginAsDevUser(server))

    const handle = within(page.document.body).getByLabelText(RESIZE_HANDLE)
    const navigation = within(page.document.body).getByRole('navigation', { name: 'Guidance hub' })

    expect(handle).toHaveRole('separator')
    expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    expect(handle).toHaveAttribute('aria-controls', 'app-layout-nav')
    expect(page.document.getElementById('app-layout-nav')).toContainElement(navigation)
    expect(handle).toHaveAttribute('aria-valuemin', '220')
    expect(handle).toHaveAttribute('aria-valuemax', '440')
    expect(handle).toHaveAttribute('aria-valuenow', '280')
    expect(handle).toHaveAttribute('aria-valuetext', '280 pixels wide')
    expect(handle).toHaveAttribute('data-default-width', '280')
    expect(handle).toHaveAttribute('tabindex', '0')
    expect(handle).not.toBeVisible()
  })

  test('is drawn at the width the user left it, before any script runs', async () => {
    keepPreferencesInTheApi({ sideNavWidth: 360 })

    const page = await hubFor(await loginAsDevUser(server))

    expect(within(page.document.body).getByLabelText(RESIZE_HANDLE)).toHaveAttribute('aria-valuenow', '360')
    expect(page.document.querySelector('style[data-side-nav-width]')).toHaveTextContent('.app-layout { --app-side-nav-width: 360px; }')
  })

  test('has no handle when the navigation is folded away', async () => {
    keepPreferencesInTheApi({ sideNavCollapsed: true })

    const page = await hubFor(await loginAsDevUser(server))

    expect(within(page.document.body).queryByLabelText(RESIZE_HANDLE)).not.toBeInTheDocument()
  })
})
