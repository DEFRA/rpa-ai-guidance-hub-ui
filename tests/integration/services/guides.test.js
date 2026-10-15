import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../src/config/config.js'
import { GuidanceApiError } from '../../../src/infra/guidance-api/client.js'
import * as guideService from '../../../src/services/guides.js'

const GUIDANCE_API_URL = config.get('guidanceApi.baseUrl')

describe('guides service integration', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  test('listGuides throws a GuidanceApiError when the API answers 400', async () => {
    nock(GUIDANCE_API_URL)
      .get('/guides')
      .query({ scheme: 'not-a-scheme' })
      .reply(statusCodes.HTTP_STATUS_BAD_REQUEST, { detail: 'Unknown scheme' })

    const error = await guideService
      .listGuides({ schemes: ['not-a-scheme'] })
      .catch(err => err)

    expect(error).toBeInstanceOf(GuidanceApiError)
    expect(error.statusCode).toBe(statusCodes.HTTP_STATUS_BAD_REQUEST)
  })
})
