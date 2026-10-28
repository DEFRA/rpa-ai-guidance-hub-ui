/**
 * @typedef {Object} RequestOptions
 * @property {string} [method] - Defaults to 'GET'
 * @property {Object} [body] - Sent as JSON
 * @property {Object<string, string|string[]>} [query] - Arrays repeat the
 *   parameter; undefined values are omitted
 * @property {Object<string, string>} [headers]
 * @property {number[]} [expected] - Non-ok statuses to return, not throw
 * @property {number|null} [timeout] - Overrides the client's; null for none
 * @property {'json'|'text'|'buffer'} [responseType] - Defaults to 'json'
 */

/**
 * Shared base class for HTTP clients.
 */
class ApiClient {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl
   * @param {number} [options.timeout] - Request timeout in ms
   * @param {typeof Error} options.errorClass - Thrown on unexpected non-ok
   *   statuses; must provide `fromResponse(method, path, response)`
   * @param {() => Promise<Object<string, string>>} [options.getAuthHeaders] -
   *   Headers added to every request, e.g. `Authorization`
   */
  constructor ({ baseUrl, timeout, errorClass, getAuthHeaders }) {
    this.baseUrl = baseUrl
    this.timeout = timeout
    this.errorClass = errorClass
    this.getAuthHeaders = getAuthHeaders
  }

  /**
   * Make an HTTP request and return `{ ok, status, data, headers }`.
   *
   * Non-ok statuses throw unless listed in `options.expected`, in which
   * case `data` is null.
   *
   * @param {string} path
   * @param {RequestOptions} [options]
   */
  async request (path, options = {}) {
    const url = _buildUrl(this.baseUrl, path, options.query)
    const timeout = options.timeout === undefined ? this.timeout : options.timeout
    const authHeaders = this.getAuthHeaders ? await this.getAuthHeaders() : {}
    const fetchOptions = _buildFetchOptions(options, timeout, authHeaders)
    const response = await fetch(url, fetchOptions)

    return _handleResponse(response, {
      method: fetchOptions.method,
      path,
      expected: options.expected,
      responseType: options.responseType,
      errorClass: this.errorClass
    })
  }
}

/**
 * Builds a URL, appending any defined query parameters.
 *
 * @private
 */
function _buildUrl (baseUrl, path, query = {}) {
  const url = new URL(`${baseUrl}${path}`)

  Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .flatMap(([key, value]) => [value].flat().map(item => [key, item]))
    .forEach(([key, item]) => url.searchParams.append(key, item))

  return url
}

/**
 * Builds the options object passed to fetch.
 *
 * @private
 */
function _buildFetchOptions (options, timeout, authHeaders) {
  const method = options.method || 'GET'

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders,
    ...options.headers
  }

  const signal = timeout ? AbortSignal.timeout(timeout) : undefined
  const body = options.body ? JSON.stringify(options.body) : undefined

  return { method, headers, signal, body }
}

/**
 * Returns a result for ok or expected statuses, throws for anything else.
 *
 * @private
 */
async function _handleResponse (response, context) {
  const { method, path, expected = [], responseType, errorClass } = context

  if (response.ok) {
    return _result(response, true, await _readBody(response, responseType))
  }

  if (expected.includes(response.status)) {
    return _result(response, false, null)
  }

  throw errorClass.fromResponse(method, path, response)
}

/**
 * @private
 */
function _result (response, ok, data) {
  return {
    ok,
    status: response.status,
    data,
    headers: response.headers
  }
}

/**
 * Reads an ok response body; `responseType` defaults to 'json'.
 *
 * @private
 */
async function _readBody (response, responseType = 'json') {
  if (responseType === 'text') {
    return response.text()
  }

  if (responseType === 'buffer') {
    return Buffer.from(await response.arrayBuffer())
  }

  return response.json()
}

export {
  ApiClient
}
