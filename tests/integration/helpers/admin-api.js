import { constants as statusCodes } from 'node:http2'

import nock from 'nock'

import { config } from '../../../src/config/config.js'
import { userResponse } from '../../fixtures/guidance-api.js'

/**
 * Stands in for the guidance API finding the signed-in user, so the session
 * knows the hub's id for them, which an administrator's request carries.
 * `nock.cleanAll()` takes it away.
 *
 * @returns {{id: string}} The user the API finds
 */
function findTheUserInTheApi () {
  const user = userResponse()

  nock(config.get('guidanceApi.baseUrl'))
    .persist()
    .post('/users')
    .reply(statusCodes.HTTP_STATUS_OK, user)

  return user
}

export { findTheUserInTheApi }
