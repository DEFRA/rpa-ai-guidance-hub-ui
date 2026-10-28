import Https from 'node:https'

import * as clientSts from '@aws-sdk/client-sts'

import { config } from '../../config/config.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

const SIGNING_ALGORITHM = 'RS256'

let stsClient = null

/** @type {Map<string, CachedWebIdentityToken>} */
const cachedTokensByAudience = new Map()

/**
 * Returns an AWS STS web identity token (`GetWebIdentityToken`) for
 * `audience`, signed by the account's STS issuer and representing the
 * ambient AWS identity (the ECS task role on CDP).
 *
 * Each audience has its own cached token, so a token issued for one
 * recipient is never presented to another.
 *
 * @param {string} audience - Who the token is for, e.g. the Entra app
 *   registration's federated credential or a backend service
 * @returns {Promise<string>}
 */
async function getWebIdentityToken (audience) {
  if (!cachedTokensByAudience.has(audience)) {
    cachedTokensByAudience.set(audience, new CachedWebIdentityToken(audience))
  }

  return cachedTokensByAudience.get(audience).getOrRefresh()
}

/**
 * The cached token for a single audience.
 */
class CachedWebIdentityToken {
  #token = null
  #expiresAt = 0
  #refreshInFlight = null

  constructor (audience) {
    const { durationSeconds, earlyRefreshMs } = config.get('webIdentityToken')

    this.audience = audience
    this.durationSeconds = durationSeconds
    this.earlyRefreshMs = earlyRefreshMs
  }

  /**
   * Returns the cached token, or replaces it with a new one if there is none
   * or it is within `earlyRefreshMs` of expiring. Concurrent callers share a
   * single in-flight refresh.
   *
   * @returns {Promise<string>}
   */
  async getOrRefresh () {
    if (this.#token && Date.now() + this.earlyRefreshMs < this.#expiresAt) {
      return this.#token
    }

    this.#refreshInFlight ??= this.#refresh().finally(() => {
      this.#refreshInFlight = null
    })

    return this.#refreshInFlight
  }

  async #refresh () {
    const { WebIdentityToken: token, Expiration: expiration } = await _getStsClient().send(
      new clientSts.GetWebIdentityTokenCommand({
        Audience: [this.audience],
        SigningAlgorithm: SIGNING_ALGORITHM,
        DurationSeconds: this.durationSeconds
      })
    )

    if (!token) {
      throw new Error(`STS returned no web identity token for audience ${this.audience}`)
    }

    logger.info({ audience: this.audience, expiration }, 'Issued STS web identity token')

    this.#token = token
    this.#expiresAt = expiration?.getTime() ?? Date.now() + this.durationSeconds * 1000

    return token
  }
}

/**
 * @private
 */
function _getStsClient () {
  // The SDK creates its own https agent by default, which bypasses the
  // egress proxy that `--use-env-proxy` wires into the global agent.
  stsClient ??= new clientSts.STSClient({
    requestHandler: { httpsAgent: Https.globalAgent }
  })

  return stsClient
}

export { getWebIdentityToken }
