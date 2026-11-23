import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { createServer } from '../../../../../../src/server/server.js'
import { config } from '../../../../../../src/config/config.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { errorSummaryOf, pageOf } from '../../../../helpers/page.js'
import { completeParse } from '../../../../helpers/upload-journey.js'
import { guideTitlesResponse, stagedDocumentResponse } from '../../../../../fixtures/guidance-api.js'

const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')
const CHOICE_URL = '/create-guidance/upload-guide/new-or-update'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const FILE_TITLE = 'Claiming the SFI payment'
const GUIDE_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const OTHER_ID = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'

function mockFileTitle () {
  nock(GUIDANCE_API_URL)
    .get('/guides/staging/file-1')
    .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete', title: FILE_TITLE }))
}

function mockGuidesLike (words, items) {
  nock(GUIDANCE_API_URL)
    .get('/search/titles')
    .query({ q: words })
    .reply(statusCodes.HTTP_STATUS_OK, guideTitlesResponse({ items }))
}

const LIKE_THE_FILE = [
  { guideId: GUIDE_ID, title: 'Claiming the SFI payment' },
  { guideId: OTHER_ID, title: 'Claiming the CS payment' }
]

describe('Choosing whether an upload is a new guide or a new version of one', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server?.stop({ timeout: 0 })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  async function processed () {
    return completeParse(server, await loginAsDevUser(server))
  }

  function guidesOffered (page) {
    return within(page.getByRole('group', { name: `Guides like ‘${FILE_TITLE}’` }))
  }

  test('sends a request with no upload back to the upload page', async () => {
    const response = await server.inject({
      method: 'GET',
      url: CHOICE_URL,
      headers: { cookie: await loginAsDevUser(server) }
    })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(response.headers.location).toBe('/create-guidance/upload-guide')
  })

  test('offers New guide and Update an existing guide, neither chosen', async () => {
    const cookie = await processed()
    mockFileTitle()
    mockGuidesLike(FILE_TITLE, LIKE_THE_FILE)

    const response = await server.inject({ method: 'GET', url: CHOICE_URL, headers: { cookie } })

    const page = pageOf(response.payload)
    const question = within(page.getByRole('group', { name: 'Is this a new guide, or a new version of one we already have?' }))
    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(question.getByRole('radio', { name: 'New guide' })).not.toBeChecked()
    expect(question.getByRole('radio', { name: 'Update an existing guide' })).not.toBeChecked()
  })

  test('searches by the title read from the file, and offers the guides with titles like it, none chosen', async () => {
    const cookie = await processed()
    mockFileTitle()
    mockGuidesLike(FILE_TITLE, LIKE_THE_FILE)

    const response = await server.inject({ method: 'GET', url: CHOICE_URL, headers: { cookie } })

    const page = pageOf(response.payload)
    const guides = guidesOffered(page)
    expect(page.getByRole('searchbox', { name: 'Search for a guide by its title' })).toHaveValue(FILE_TITLE)
    expect(guides.getAllByRole('radio').map(radio => radio.value)).toEqual([GUIDE_ID, OTHER_ID])
    expect(guides.getByRole('radio', { name: 'Claiming the CS payment' })).not.toBeChecked()
    expect(guides.getByRole('radio', { name: 'Claiming the SFI payment' })).not.toBeChecked()
  })

  test('searches for nothing when the file has no title, and offers no guides', async () => {
    const cookie = await processed()
    nock(GUIDANCE_API_URL)
      .get('/guides/staging/file-1')
      .reply(statusCodes.HTTP_STATUS_OK, stagedDocumentResponse({ parsingStatus: 'complete', title: null }))

    const response = await server.inject({ method: 'GET', url: CHOICE_URL, headers: { cookie } })

    const page = pageOf(response.payload)
    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(page.getByRole('searchbox', { name: 'Search for a guide by its title' })).toHaveValue('')
    expect(page.queryByText(/No guides found/)).not.toBeInTheDocument()
  })

  test('searches for other words without JavaScript, with Update an existing guide still chosen', async () => {
    const cookie = await processed()
    mockGuidesLike('Payments', [{ guideId: OTHER_ID, title: 'Payments in arrears' }])

    const response = await server.inject({
      method: 'GET',
      url: `${CHOICE_URL}?kind=update&q=Payments`,
      headers: { cookie }
    })

    const page = pageOf(response.payload)
    const search = page.getByRole('button', { name: 'Search' })
    expect(search).toHaveAttribute('formmethod', 'get')
    expect(search).toHaveAttribute('formaction', CHOICE_URL)
    expect(page.getByRole('searchbox', { name: 'Search for a guide by its title' })).toHaveValue('Payments')
    expect(page.getByRole('radio', { name: 'Update an existing guide' })).toBeChecked()
    expect(page.getByRole('radio', { name: 'Payments in arrears' })).toHaveAttribute('value', OTHER_ID)
  })

  test('says so when no guide has a title like the words', async () => {
    const cookie = await processed()
    mockGuidesLike('Nothing like it', [])

    const response = await server.inject({
      method: 'GET',
      url: `${CHOICE_URL}?kind=update&q=Nothing%20like%20it`,
      headers: { cookie }
    })

    expect(pageOf(response.payload).getByText('No guides found for ‘Nothing like it’')).toBeInTheDocument()
  })

  test('goes on to the details of a new guide', async () => {
    const cookie = await processed()

    const response = await server.inject({
      method: 'POST',
      url: CHOICE_URL,
      payload: { kind: 'new', q: FILE_TITLE },
      headers: { cookie }
    })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(response.headers.location).toBe(METADATA_URL)
  })

  test('goes on to the details of an update once a guide is chosen', async () => {
    const cookie = await processed()

    const response = await server.inject({
      method: 'POST',
      url: CHOICE_URL,
      payload: { kind: 'update', guideId: GUIDE_ID, q: FILE_TITLE },
      headers: { cookie }
    })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(response.headers.location).toBe(METADATA_URL)
  })

  test('asks again when nothing is chosen', async () => {
    const cookie = await processed()
    mockGuidesLike(FILE_TITLE, LIKE_THE_FILE)

    const response = await server.inject({
      method: 'POST',
      url: CHOICE_URL,
      payload: { q: FILE_TITLE },
      headers: { cookie }
    })

    const page = pageOf(response.payload)
    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    expect(errorSummaryOf(page).getByRole('link', { name: 'Select whether this is a new guide or a new version of one' }))
      .toHaveAttribute('href', '#kind')
  })

  test('asks again when an update names no guide, with the guides like the words searched', async () => {
    const cookie = await processed()
    mockGuidesLike(FILE_TITLE, LIKE_THE_FILE)

    const response = await server.inject({
      method: 'POST',
      url: CHOICE_URL,
      payload: { kind: 'update', q: FILE_TITLE },
      headers: { cookie }
    })

    const page = pageOf(response.payload)
    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    expect(errorSummaryOf(page).getByRole('link', { name: 'Select the guide this document updates' }))
      .toHaveAttribute('href', '#guideId')
    expect(page.getByRole('radio', { name: 'Update an existing guide' })).toBeChecked()
    expect(guidesOffered(page).getAllByRole('radio')).toHaveLength(2)
  })
})
