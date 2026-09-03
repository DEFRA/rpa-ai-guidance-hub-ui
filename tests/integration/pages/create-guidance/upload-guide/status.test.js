import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { initiateUploadResponse, uploadStatusResponse, rejectedFile } from '../../../../fixtures/cdp-uploader.js'
import { createServer } from '../../../../../src/server/server.js'
import { loginAsDevUser } from '../../../helpers/login.js'
import { mergeCookies } from '../../../helpers/cookies.js'
import { config } from '../../../../../src/config/config.js'

const CDP_UPLOADER_URL = config.get('cdpUploader.baseUrl')

async function startMigration (server, cookie) {
  const uploadId = 'u-123'

  nock(CDP_UPLOADER_URL).post('/initiate').reply(statusCodes.HTTP_STATUS_OK, initiateUploadResponse({ uploadId }))

  const get = await server.inject({
    method: 'GET',
    url: '/create-guidance/upload-guide',
    headers: { cookie }
  })

  expect(get.statusCode).toBe(statusCodes.HTTP_STATUS_OK)

  return { uploadId, cookie: mergeCookies(cookie, get.headers['set-cookie']) }
}

describe('upload guide status page integration', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    nock.disableNetConnect()
  })

  afterAll(async () => {
    nock.enableNetConnect()
    await server.stop({ timeout: 0 })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  test('redirects to upload form when no session upload exists', async () => {
    const cookie = await loginAsDevUser(server)

    const res = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide/status',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(res.headers.location).toBe('/create-guidance/upload-guide')
  })

  test('renders status page with meta refresh when upload is in progress (pending)', async () => {
    const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

    nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'pending' }))

    const res = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide/status',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(res.payload).toContain('Checking your document')
    expect(res.payload).toContain('http-equiv="refresh"')
    expect(res.payload).toContain('app-progress-bar')
  })

  test('redirects to metadata when upload is ready and has no errors', async () => {
    const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

    nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({ uploadStatus: 'ready' }))

    const res = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide/status',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_FOUND)
    expect(res.headers.location).toBe('/create-guidance/metadata')
  })

  test('renders error view when upload has rejected files', async () => {
    const { uploadId, cookie } = await startMigration(server, await loginAsDevUser(server))

    nock(CDP_UPLOADER_URL).get(`/status/${uploadId}`).reply(statusCodes.HTTP_STATUS_OK, uploadStatusResponse({
      uploadStatus: 'ready',
      numberOfRejectedFiles: 1,
      form: {
        file: rejectedFile({ errorMessage: 'The file contains a virus' })
      }
    }))

    const res = await server.inject({
      method: 'GET',
      url: '/create-guidance/upload-guide/status',
      headers: { cookie }
    })

    expect(res.statusCode).toBe(statusCodes.HTTP_STATUS_OK)
    expect(res.payload).toContain('There is a problem')
    expect(res.payload).toContain('The file contains a virus')
    expect(res.payload).not.toContain('http-equiv="refresh"')
  })
})
