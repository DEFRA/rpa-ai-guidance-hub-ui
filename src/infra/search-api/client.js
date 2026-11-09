import { config } from '../../config/config.js'
import { ApiClient } from '../api-client.js'
import { getWebIdentityToken } from '../aws/web-identity-token.js'

class SearchApiError extends Error {
  constructor (message, statusCode) {
    super(message)
    this.name = 'SearchApiError'
    this.statusCode = statusCode
  }

  static fromResponse (method, path, response) {
    const message =
      `search API ${method} ${path} ` +
      `failed: ${response.status} ${response.statusText}`
    return new SearchApiError(message, response.status)
  }
}

/**
 * The search service: a service of its own, apart from the guidance API, so
 * that either can fail without the other.
 */
class SearchApiClient extends ApiClient {
  constructor (baseUrl) {
    super({
      baseUrl: baseUrl || config.get('searchApi.baseUrl'),
      timeout: config.get('searchApi.timeout'),
      errorClass: SearchApiError,
      getAuthHeaders: config.get('searchApi.auth') === 'web-identity' ? _getWebIdentityHeaders : undefined
    })
  }
}

async function _getWebIdentityHeaders () {
  const token = await getWebIdentityToken(config.get('searchApi.audience'))
  return { Authorization: `Bearer ${token}` }
}

const searchApiClient = new SearchApiClient()

export { SearchApiClient, SearchApiError, searchApiClient }
