/**
 * AWS STS `GetWebIdentityToken` responses and interception.
 *
 * Single owner of the STS wire format, so that every test that reaches
 * `GetWebIdentityToken` - directly, via the Entra federated client
 * assertion, or via the guidance API's bearer token - uses the same
 * shapes. Each factory returns a fresh value - nothing here is shared
 * mutable state.
 *
 * STS speaks the awsQuery protocol: requests are form-encoded and responses
 * are XML. Tests drive the real `@aws-sdk/client-sts` client, which parses
 * these bodies, so element names must match the STS wire format exactly.
 */

import nock from 'nock'

const STS_REGION = 'eu-west-2'
const STS_URL = `https://sts.${STS_REGION}.amazonaws.com`
const STS_NAMESPACE = 'https://sts.amazonaws.com/doc/2011-06-15/'

/**
 * Body of a successful `GetWebIdentityToken` call.
 *
 * @param {Object} [options]
 * @param {string} [options.token] - The issued token; falsy omits the element
 * @param {number|null} [options.expiresInSec] - Seconds until expiry; null
 *   omits the element
 * @returns {string}
 */
function getWebIdentityTokenResponse ({ token = 'sts-jwt-a', expiresInSec = 300 } = {}) {
  const tokenXml = token ? `<WebIdentityToken>${token}</WebIdentityToken>` : ''
  const expiry = expiresInSec === null
    ? ''
    : `<Expiration>${new Date(Date.now() + expiresInSec * 1000).toISOString()}</Expiration>`

  return `<GetWebIdentityTokenResponse xmlns="${STS_NAMESPACE}">` +
    `<GetWebIdentityTokenResult>${tokenXml}${expiry}</GetWebIdentityTokenResult>` +
    '<ResponseMetadata><RequestId>test-request-id</RequestId></ResponseMetadata>' +
    '</GetWebIdentityTokenResponse>'
}

/**
 * Body of a failed STS call. The SDK surfaces `message` as the thrown
 * error's message and `code` as its name.
 *
 * @param {Object} [options]
 * @param {string} [options.code]
 * @param {string} [options.message]
 * @returns {string}
 */
function stsErrorResponse ({ code = 'AccessDenied', message = 'not allowed' } = {}) {
  return `<ErrorResponse xmlns="${STS_NAMESPACE}">` +
    `<Error><Type>Sender</Type><Code>${code}</Code><Message>${message}</Message></Error>` +
    '<RequestId>test-request-id</RequestId></ErrorResponse>'
}

/**
 * Lists the audiences in a form-encoded `GetWebIdentityToken` body, which
 * awsQuery flattens to `Audience.member.1`, `Audience.member.2`, ...
 *
 * @param {Record<string, string>} body
 * @returns {string[]}
 */
function requestedAudiences (body) {
  return Object.keys(body)
    .filter((key) => key.startsWith('Audience.member.'))
    .map((key) => body[key])
}

/**
 * Intercepts one `GetWebIdentityToken` call, recording its form-encoded
 * request body.
 *
 * With `audience` set, only a request for that audience matches. Use this
 * whenever the code under test may fetch tokens for more than one audience
 * (e.g. an Entra client assertion and a token for the guidance API), so
 * that one caller cannot consume the interceptor meant for the other.
 *
 * @param {Object} [options]
 * @param {string} [options.audience] - Only match requests for this audience
 * @param {string} [options.body] - Response body; see the factories above
 * @param {number} [options.status]
 * @returns {{scope: import('nock').Scope, captured: {body?: Record<string, string>}}}
 */
function interceptGetWebIdentityToken ({ audience, body = getWebIdentityTokenResponse(), status = 200 } = {}) {
  const captured = {}

  const scope = nock(STS_URL)
    .post('/', (requestBody) => {
      if (requestBody.Action !== 'GetWebIdentityToken') {
        return false
      }

      if (audience && !requestedAudiences(requestBody).includes(audience)) {
        return false
      }

      captured.body = requestBody

      return true
    })
    .reply(status, body, { 'content-type': 'text/xml' })

  return { scope, captured }
}

export {
  STS_REGION,
  STS_URL,
  getWebIdentityTokenResponse,
  stsErrorResponse,
  interceptGetWebIdentityToken
}
