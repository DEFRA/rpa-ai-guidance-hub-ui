import { config } from '../../../config/config.js'
import { getWebIdentityToken } from '../../../infra/aws/web-identity-token.js'

const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

/**
 * Returns the parameters that authenticate this app to the Entra token
 * endpoint, to be merged into the body of any token request (authorization
 * code or refresh token grant).
 *
 * - 'secret': the app registration's client secret.
 * - 'federated': an AWS STS-issued web identity token presented as a client
 *   assertion, which the app registration trusts via a federated identity
 *   credential. No secret is held by the app.
 *
 * @returns {Promise<Record<string, string>>}
 */
async function getClientAuthParams () {
  if (config.get('auth.entra.clientAuth') === 'secret') {
    return { client_secret: config.get('auth.entra.clientSecret') }
  }

  return {
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: await getWebIdentityToken(config.get('auth.entra.federatedAudience'))
  }
}

export { getClientAuthParams }
