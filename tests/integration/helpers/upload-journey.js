import { constants as statusCodes } from 'node:http2'
import nock from 'nock'

import { config } from '../../../src/config/config.js'
import { mergeCookies } from './cookies.js'
import { pageOf } from './page.js'
import {
  audiencesResponse,
  schemesResponse,
  stagedDocumentResponse,
  systemsResponse
} from '../../fixtures/guidance-api.js'
import {
  initiateUploadResponse,
  uploadStatusResponse
} from '../../fixtures/cdp-uploader.js'

/**
 * Steps of the create guidance journey, driven through the server, for the
 * integration tests of the pages along it.
 */

const GUIDANCE_API_BASE_URL = config.get('guidanceApi.baseUrl')
const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')
const PROCESSING_URL = '/create-guidance/upload-guide/processing'
const CHOICE_URL = '/create-guidance/upload-guide/new-or-update'
const METADATA_URL = '/create-guidance/upload-guide/metadata'
const CHECK_ANSWERS_URL = '/create-guidance/upload-guide/metadata/check-answers'

function mockReferenceData () {
  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/schemes')
    .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/systems')
    .reply(statusCodes.HTTP_STATUS_OK, systemsResponse())

  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/audiences')
    .reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())
}

async function startMigration (server, cookie, uploadId = 'u-check') {
  nock(CDP_UPLOADER_URL)
    .post('/initiate')
    .reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId }))

  const get = await server.inject({
    method: 'GET',
    url: '/create-guidance/upload-guide',
    headers: { cookie }
  })

  expect(get.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

  return mergeCookies(cookie, get.headers['set-cookie'])
}

async function completeParse (server, cookie, uploadId = 'u-check') {
  let sessionCookie = await startMigration(server, cookie, uploadId)

  nock(CDP_UPLOADER_URL)
    .get(`/status/${uploadId}`)
    .times(2)
    .reply(
      statusCodes.HTTP_STATUS_OK,
      uploadStatusResponse({ uploadStatus: 'ready' })
    )

  const first = await server.inject({
    method: 'GET',
    url: PROCESSING_URL,
    headers: { cookie: sessionCookie }
  })

  expect(first.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
  sessionCookie = mergeCookies(sessionCookie, first.headers['set-cookie'])

  nock(GUIDANCE_API_BASE_URL)
    .get('/guides/staging/file-1')
    .once()
    .reply(
      statusCodes.HTTP_STATUS_OK,
      stagedDocumentResponse({ parsingStatus: 'complete' })
    )

  const second = await server.inject({
    method: 'GET',
    url: PROCESSING_URL,
    headers: { cookie: sessionCookie }
  })

  expect(second.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)

  return mergeCookies(sessionCookie, second.headers['set-cookie'])
}

/**
 * Choose to make the upload a new version of a guide.
 *
 * @param {Object} server
 * @param {string} cookie
 * @param {Object} guide - The guide, as `GET /guides/{id}` sends it
 * @returns {Promise<string>} The session's cookie
 */
async function chooseToUpdate (server, cookie, guide) {
  nock(GUIDANCE_API_BASE_URL)
    .get(`/guides/${guide.id}`)
    .reply(statusCodes.HTTP_STATUS_OK, guide)

  const response = await server.inject({
    method: 'POST',
    url: CHOICE_URL,
    payload: { kind: 'update', guideId: guide.id, q: '' },
    headers: { cookie }
  })

  expect(response.headers.location).toBe(METADATA_URL)

  return mergeCookies(cookie, response.headers['set-cookie'])
}

/**
 * Upload a file and answer every question, up to the check page.
 *
 * @param {Object} server
 * @param {string} cookie
 * @param {Object} [options]
 * @param {Object} [options.updates] - The guide the upload is a new version
 *   of, as `GET /guides/{id}` sends it; a new guide when not given
 * @returns {Promise<string>} The session's cookie
 */
async function completeAllMetadata (server, cookie, { updates } = {}) {
  let sessionCookie = await completeParse(server, cookie)

  if (updates) {
    sessionCookie = await chooseToUpdate(server, sessionCookie, updates)
  }

  return completeDetails(server, sessionCookie)
}

/**
 * Answer both details screens, up to the check page.
 *
 * @param {Object} server
 * @param {string} cookie
 * @returns {Promise<string>} The session's cookie
 */
async function completeDetails (server, cookie) {
  let sessionCookie = cookie

  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/schemes')
    .reply(statusCodes.HTTP_STATUS_OK, schemesResponse())

  const guideDetailsResponse = await server.inject({
    method: 'POST',
    url: '/create-guidance/upload-guide/metadata',
    payload: { guideTitle: 'Complete Guide Title', versionNumber: '1.0', schemes: ['sustainable-farming-incentive-sfi'] },
    headers: { cookie: sessionCookie }
  })

  expect(guideDetailsResponse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
  sessionCookie = mergeCookies(
    sessionCookie,
    guideDetailsResponse.headers['set-cookie']
  )

  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/systems')
    .reply(statusCodes.HTTP_STATUS_OK, systemsResponse())
  nock(GUIDANCE_API_BASE_URL)
    .get('/reference/audiences')
    .reply(statusCodes.HTTP_STATUS_OK, audiencesResponse())

  const purposeResponse = await server.inject({
    method: 'POST',
    url: '/create-guidance/upload-guide/metadata/purpose',
    payload: {
      owner: 'designer@example.com',
      goal: 'Clear guidance purpose',
      requirements: 'Standard training required',
      systems: ['crm'],
      audience: ['processor']
    },
    headers: { cookie: sessionCookie }
  })

  expect(purposeResponse.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
  expect(purposeResponse.headers.location).toBe(CHECK_ANSWERS_URL)
  return mergeCookies(sessionCookie, purposeResponse.headers['set-cookie'])
}

async function expectFreshUploadForm (server, cookie) {
  nock(CDP_UPLOADER_URL)
    .post('/initiate')
    .reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({
      uploadId: 'u-next',
      uploadUrl: 'http://cdp-uploader.test/upload-and-scan/u-next'
    }))

  const response = await server.inject({
    method: 'GET',
    url: '/create-guidance/upload-guide',
    headers: { cookie }
  })

  expect(response.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
  expect(pageOf(response.payload).getByLabelText('Upload a file').form).toHaveAttribute('action', '/upload-and-scan/u-next')
}

export {
  completeAllMetadata,
  completeDetails,
  completeParse,
  expectFreshUploadForm,
  mockReferenceData,
  startMigration
}
