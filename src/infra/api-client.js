/**
 * ApiClient - Shared base class for HTTP clients
 */
class ApiClient {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - The base URL for the API
   * @param {number} [options.timeout] - Request timeout in milliseconds
   * @param {typeof Error} options.errorClass - Error class to throw on
   *   non-ok status
   */
  constructor ({ baseUrl, timeout, errorClass }) {
    this.baseUrl = baseUrl
    this.timeout = timeout
    this.errorClass = errorClass
  }

  /**
   * Make an HTTP request
   *
   * @param {string} path - The API endpoint path
   * @param {Object} [options] - The request options
   * @param {string} [options.method] - The HTTP method (default: 'GET')
   * @param {Object<string, any>?} [options.body] - The request body
   * @param {Object<string, string|string[]>?} [options.query] - Query
   *   string parameters; an array repeats the parameter
   * @param {Object<string, string>?} [options.headers] - Additional headers
   * @param {number[]} [options.expected] - List of expected non-ok status
   *   codes
   * @param {number|null} [options.timeout] - Request timeout in
   *   milliseconds, in place of the client's; null waits without limit
   * @param {'json'|'text'|'buffer'} [options.responseType] - How to read an
   *   ok response body (default: 'json'); 'buffer' gives a Buffer
   * @returns {Promise<{ok: boolean, status: number, data: any, headers:
   *   Headers}>} - The response object
   * @throws {Error} - When response is not ok and status is not in
   *   expected list
   * @throws {SyntaxError} - When an ok 'json' response body isn't valid JSON
   */
  async request (path, options = {}) {
    const url = _buildUrl(this.baseUrl, path, options.query)
    const timeout = options.timeout === undefined ? this.timeout : options.timeout
    const fetchOptions = _buildFetchOptions(options, timeout)
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
 * @private
 *
 * Builds a URL, appending any defined query string parameters.
 *
 * @param {string} baseUrl - The base URL for the API
 * @param {string} path - The API endpoint path
 * @param {Object<string, string|string[]>} [query] - Query string
 *   parameters; an array repeats the parameter
 * @returns {URL} The built URL
 */
function _buildUrl (baseUrl, path, query = {}) {
  const url = new URL(`${baseUrl}${path}`)

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(key, item))
    } else if (value !== undefined) {
      url.searchParams.set(key, value)
    }
  }

  return url
}

/**
 * @private
 *
 * Builds the options object passed to fetch.
 *
 * @param {Object} options - The request options
 * @param {number} [timeout] - Request timeout in milliseconds
 * @returns {{method: string, headers: Object, signal: AbortSignal
 *   |undefined, body: string|undefined}} The fetch options
 */
function _buildFetchOptions (options, timeout) {
  const method = options.method || 'GET'

  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers
  }

  const signal = timeout ? AbortSignal.timeout(timeout) : undefined
  const body = options.body ? JSON.stringify(options.body) : undefined

  return { method, headers, signal, body }
}

/**
 * @private
 *
 * Resolves a fetch response, returning a result object for ok/expected
 * statuses or throwing for unexpected non-ok statuses.
 *
 * @param {Response} response - The fetch response
 * @param {Object} context
 * @param {string} context.method - The HTTP method used for the request
 * @param {string} context.path - The API endpoint path
 * @param {number[]} [context.expected] - Expected non-ok status codes
 * @param {'json'|'text'|'buffer'} [context.responseType] - How to read an
 *   ok body
 * @param {typeof Error} context.errorClass - Error class to throw on
 *   unexpected non-ok status
 * @returns {Promise<{ok: boolean, status: number, data: any, headers:
 *   Headers}>} The response result
 * @throws {Error} When response is not ok and status is not expected
 */
async function _handleResponse (response, context) {
  const { method, path, expected = [], responseType, errorClass } = context

  if (response.ok) {
    const data = await _readBody(response, responseType)

    return { ok: true, status: response.status, data, headers: response.headers }
  }

  if (expected.includes(response.status)) {
    return { ok: false, status: response.status, data: null }
  }

  throw errorClass.fromResponse(method, path, response)
}

/**
 * @private
 *
 * Reads an ok response body in the requested form.
 *
 * @param {Response} response - The fetch response
 * @param {'json'|'text'|'buffer'} [responseType] - Defaults to 'json'
 * @returns {Promise<any>} The parsed body
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
