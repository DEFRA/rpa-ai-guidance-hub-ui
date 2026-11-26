import { constants as statusCodes } from 'node:http2'

import { within } from '@testing-library/dom'
import nock from 'nock'

import { createServer } from '../../../../../../src/server/server.js'
import { config } from '../../../../../../src/config/config.js'
import { mergeCookies } from '../../../../helpers/cookies.js'
import { loginAsDevUser } from '../../../../helpers/login.js'
import { errorSummaryOf, pageOf } from '../../../../helpers/page.js'
import { completeParse } from '../../../../helpers/upload-journey.js'
import {
  audiencesResponse,
  guideResponse,
  guideTitlesResponse,
  refusalResponse,
  schemesResponse,
  stagedDocumentResponse,
  systemsResponse,
  versionResponse
} from '../../../../../fixtures/guidance-api.js'

const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')
const CHOICE_URL = '/create-guidance/upload-guide/new-or-update'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const PURPOSE_URL = '/create-guidance/upload-guide/metadata/purpose'
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

// What the API answers when the search service it asks fails.
function mockSearchFails (words) {
  nock(GUIDANCE_API_URL)
    .get('/search/titles')
    .query({ q: words })
    .reply(statusCodes.HTTP_STATUS_BAD_GATEWAY, refusalResponse({ detail: 'The search service is not available' }))
}

const SEARCH_UNAVAILABLE = 'Search is not available at the moment. Try again later.'

const LIKE_THE_FILE = [
  { guideId: GUIDE_ID, title: 'Claiming the SFI payment' },
  { guideId: OTHER_ID, title: 'Claiming the CS payment' }
]

function aGuide ({ id, title, schemes = ['Sustainable Farming Incentive (SFI)'] }) {
  return guideResponse({
    id,
    metadata: {
      guideTitle: title,
      schemeYear: 2026,
      schemes,
      owner: 'owner@example.com',
      goal: 'Explains how to claim the payment',
      requirements: 'CRM access',
      systems: ['CRM'],
      audience: ['Processor']
    },
    versions: [versionResponse({ title, versionNumber: '1.0' })]
  })
}

const CHOSEN_GUIDE = aGuide({ id: GUIDE_ID, title: 'Claiming the SFI payment, 2025' })
const OTHER_GUIDE = aGuide({ id: OTHER_ID, title: 'Claiming the CS payment' })

function mockGuide (guide) {
  nock(GUIDANCE_API_URL)
    .get(`/guides/${guide.id}`)
    .reply(statusCodes.HTTP_STATUS_OK, guide)
}

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

  /**
   * An upload processed, with the guide given chosen as the one it is a new
   * version of.
   */
  async function uploadWithGuideChosen (guide) {
    return chooseGuide(await processed(), guide)
  }

  /**
   * What the Update an existing guide choice shows when chosen: the search,
   * and where the guides are.
   */
  function updateChoiceOf (page) {
    return within(page.getByRole('searchbox', { name: 'Search for a guide by its title' }).closest('.govuk-radios__conditional'))
  }

  function guidesOffered (page) {
    return within(page.getByRole('group', { name: `Guides like ‘${FILE_TITLE}’` }))
  }

  async function choose (cookie, payload) {
    const response = await server.inject({
      method: 'POST',
      url: CHOICE_URL,
      payload,
      headers: { cookie }
    })

    expect(response.headers.location).toBe(METADATA_URL)

    return mergeCookies(cookie, response.headers['set-cookie'])
  }

  async function chooseGuide (cookie, guide) {
    mockGuide(guide)

    return choose(cookie, { kind: 'update', guideId: guide.id, q: FILE_TITLE })
  }

  async function detailsPage (cookie) {
    mockFileTitle()
    nock(GUIDANCE_API_URL)
      .get('/reference/schemes')
      .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

    const response = await server.inject({
      method: 'GET',
      url: METADATA_URL,
      headers: { cookie }
    })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

    return pageOf(response.payload)
  }

  async function purposePage (cookie) {
    nock(GUIDANCE_API_URL)
      .get('/reference/systems')
      .reply(statusCodes.HTTP_STATUS_OK, systemsResponse())
    nock(GUIDANCE_API_URL)
      .get('/reference/audiences')
      .reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())

    const response = await server.inject({
      method: 'GET',
      url: PURPOSE_URL,
      headers: { cookie }
    })

    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

    return pageOf(response.payload)
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

  test('offers both choices, and says search is not available where the guides would be, when the search fails', async () => {
    const cookie = await processed()
    mockFileTitle()
    mockSearchFails(FILE_TITLE)

    const response = await server.inject({ method: 'GET', url: CHOICE_URL, headers: { cookie } })

    const page = pageOf(response.payload)
    const question = within(page.getByRole('group', { name: 'Is this a new guide, or a new version of one we already have?' }))
    const updateChoice = updateChoiceOf(page)
    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(question.getByRole('radio', { name: 'New guide' })).not.toBeChecked()
    expect(question.getByRole('radio', { name: 'Update an existing guide' })).not.toBeChecked()
    expect(updateChoice.getByText(SEARCH_UNAVAILABLE)).toBeInTheDocument()
    expect(updateChoice.getByRole('searchbox')).toHaveValue(FILE_TITLE)
    expect(updateChoice.getByRole('button', { name: 'Search' })).toBeInTheDocument()
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
    mockGuide(CHOSEN_GUIDE)

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

  test('asks again when nothing is chosen, saying search is not available where the guides would be, when the search fails', async () => {
    const cookie = await processed()
    mockSearchFails(FILE_TITLE)

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
    expect(updateChoiceOf(page).getByText(SEARCH_UNAVAILABLE)).toBeInTheDocument()
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

  test('asks again when an update names no guide and none is offered, with the error on the search box', async () => {
    const cookie = await processed()

    const response = await server.inject({
      method: 'POST',
      url: CHOICE_URL,
      payload: { kind: 'update', q: '' },
      headers: { cookie }
    })

    const page = pageOf(response.payload)
    expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
    expect(errorSummaryOf(page).getByRole('link', { name: 'Select the guide this document updates' }))
      .toHaveAttribute('href', '#guide-search')
    expect(page.getByRole('searchbox', { name: 'Search for a guide by its title' }))
      .toHaveAccessibleDescription(/Select the guide this document updates/)
  })

  test('starts the guide details with the chosen guide\'s, all but the version number', async () => {
    const cookie = await uploadWithGuideChosen(CHOSEN_GUIDE)

    const page = await detailsPage(cookie)

    expect(page.getByLabelText('Guidance title')).toHaveValue('Claiming the SFI payment, 2025')
    expect(page.getByLabelText('Version number')).toHaveValue('')
    expect(page.getByRole('checkbox', { name: /Sustainable Farming Incentive/ })).toBeChecked()
    expect(page.getByRole('checkbox', { name: /Countryside Stewardship/ })).not.toBeChecked()
  })

  test('starts the owner and purpose with the chosen guide\'s', async () => {
    const cookie = await uploadWithGuideChosen(CHOSEN_GUIDE)

    const page = await purposePage(cookie)

    expect(page.getByLabelText('Owner email')).toHaveValue('owner@example.com')
    expect(page.getByLabelText('What is the purpose of this guidance?')).toHaveValue('Explains how to claim the payment')
    expect(page.getByLabelText('Required knowledge and training')).toHaveValue('CRM access')
    expect(page.getByRole('checkbox', { name: 'CRM' })).toBeChecked()
    expect(page.getByRole('checkbox', { name: 'SITI Agri' })).not.toBeChecked()
    expect(page.getByRole('checkbox', { name: 'Processor' })).toBeChecked()
    expect(page.getByRole('checkbox', { name: 'Team leader' })).not.toBeChecked()
  })

  test('starts a guide kept with no scheme as not scheme-specific', async () => {
    const guide = aGuide({ id: GUIDE_ID, title: 'Claiming any payment', schemes: [] })
    const cookie = await uploadWithGuideChosen(guide)

    const page = await detailsPage(cookie)

    expect(page.getByRole('checkbox', { name: 'Not scheme-specific' })).toBeChecked()
  })

  test('starts the details again with another guide\'s when another guide is chosen', async () => {
    const firstGuideChosen = await uploadWithGuideChosen(CHOSEN_GUIDE)
    const otherGuideChosen = await chooseGuide(firstGuideChosen, OTHER_GUIDE)

    const page = await detailsPage(otherGuideChosen)

    expect(page.getByLabelText('Guidance title')).toHaveValue('Claiming the CS payment')
  })

  test('starts the details again from the file when New guide is chosen after a guide', async () => {
    const guideChosen = await uploadWithGuideChosen(CHOSEN_GUIDE)
    const newGuideChosen = await choose(guideChosen, { kind: 'new', q: FILE_TITLE })

    const page = await detailsPage(newGuideChosen)

    expect(page.getByLabelText('Guidance title')).toHaveValue(FILE_TITLE)
    expect(page.getByRole('checkbox', { name: /Sustainable Farming Incentive/ })).not.toBeChecked()
  })

  test('keeps changes to the details when the same guide is chosen again', async () => {
    const guideChosen = await uploadWithGuideChosen(CHOSEN_GUIDE)

    nock(GUIDANCE_API_URL)
      .get('/reference/schemes')
      .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

    const changed = await server.inject({
      method: 'POST',
      url: METADATA_URL,
      payload: {
        guideTitle: 'Claiming the SFI payment, 2026',
        versionNumber: '2.0',
        schemes: ['sustainable-farming-incentive-sfi']
      },
      headers: { cookie: guideChosen }
    })
    expect(changed.headers.location).toBe(PURPOSE_URL)
    const detailsChanged = mergeCookies(guideChosen, changed.headers['set-cookie'])

    const sameGuideChosenAgain = await chooseGuide(detailsChanged, CHOSEN_GUIDE)

    const page = await detailsPage(sameGuideChosenAgain)

    expect(page.getByLabelText('Guidance title')).toHaveValue('Claiming the SFI payment, 2026')
    expect(page.getByLabelText('Version number')).toHaveValue('2.0')
  })
})
