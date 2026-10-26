import Https from 'node:https'

import * as clientSts from '@aws-sdk/client-sts'

import { config } from '../../../config/config.js'
import { createLogger } from '../../../infra/logging/logger.js'

const logger = createLogger()

const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

const SIGNING_ALGORITHM = 'RS256'

let federatedCredentials = null

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

  federatedCredentials ??= new FederatedCredentials()

  return {
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    client_assertion: await federatedCredentials.getToken()
  }
}

/**
 * Fetches and caches a web identity token from AWS STS
 * (`GetWebIdentityToken`), signed by the account's STS issuer and
 * representing the ambient AWS identity (the ECS task role on CDP).
 *
 * Unlike the CDP reference implementation, a failed fetch throws rather than
 * falling back to a stale or missing token - that would only surface later
 * as an opaque Entra `invalid_client` error, hiding the real cause.
 */
class FederatedCredentials {
  #token = null
  #expiresAt = 0
  #pending = null

  constructor () {
    const { audience, durationSeconds, earlyRefreshMs } = config.get('auth.entra.federated')

    this.audience = audience
    this.durationSeconds = durationSeconds
    this.earlyRefreshMs = earlyRefreshMs

    // The SDK creates its own https agent by default, which bypasses the
    // egress proxy that `--use-env-proxy` wires into the global agent.
    this.client = new clientSts.STSClient({
      requestHandler: { httpsAgent: Https.globalAgent }
    })
  }

  /**
   * Returns the cached token, or fetches a new one if there is none or it
   * is within `earlyRefreshMs` of expiring. Concurrent callers share a
   * single in-flight request.
   *
   * @returns {Promise<string>}
   */
  async getToken () {
    if (this.#token && Date.now() + this.earlyRefreshMs < this.#expiresAt) {
      return this.#token
    }

    this.#pending ??= this.#fetchToken().finally(() => {
      this.#pending = null
    })

    return this.#pending
  }

  async #fetchToken () {
    const { WebIdentityToken: token, Expiration: expiration } = await this.client.send(
      new clientSts.GetWebIdentityTokenCommand({
        Audience: [this.audience],
        SigningAlgorithm: SIGNING_ALGORITHM,
        DurationSeconds: this.durationSeconds
      })
    )

    if (!token) {
      throw new Error('STS returned no web identity token for the federated client assertion')
    }

    logger.info({ expiration }, 'Issued STS web identity token for Entra client assertion')

    this.#token = token
    this.#expiresAt = expiration?.getTime() ?? Date.now() + this.durationSeconds * 1000

    return token
  }
}

export { getClientAuthParams }
