import Https from 'node:https'

import * as clientSts from '@aws-sdk/client-sts'

import { config } from '../../config/config.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

const SIGNING_ALGORITHM = 'RS256'

/**
 * Issues AWS STS web identity tokens (`GetWebIdentityToken`), signed by the
 * account's STS issuer and representing the ambient AWS identity (the ECS
 * task role on CDP).
 *
 * Each audience has its own cached token, so a token issued for one
 * recipient is never presented to another.
 */
class WebIdentityTokenProvider {
  /** @type {Map<string, CachedWebIdentityToken>} */
  #cachedTokensByAudience = new Map()
  #stsClient = null

  /**
   * @param {Object} options
   * @param {number} options.durationSeconds - Lifetime requested for each token
   * @param {number} options.earlyRefreshMs - Replace a cached token this long
   *   before it expires
   */
  constructor ({ durationSeconds, earlyRefreshMs }) {
    this.durationSeconds = durationSeconds
    this.earlyRefreshMs = earlyRefreshMs
  }

  /**
   * @param {string} audience - Who the token is for, e.g. the Entra app
   *   registration's federated credential or a backend service
   * @returns {Promise<string>}
   */
  async getToken (audience) {
    if (!this.#cachedTokensByAudience.has(audience)) {
      this.#cachedTokensByAudience.set(audience, new CachedWebIdentityToken({
        earlyRefreshMs: this.earlyRefreshMs,
        fetchToken: () => this.#fetchToken(audience)
      }))
    }

    return this.#cachedTokensByAudience.get(audience).getOrRefresh()
  }

  async #fetchToken (audience) {
    const { WebIdentityToken: token, Expiration: expiration } = await this.#getStsClient().send(
      new clientSts.GetWebIdentityTokenCommand({
        Audience: [audience],
        SigningAlgorithm: SIGNING_ALGORITHM,
        DurationSeconds: this.durationSeconds
      })
    )

    if (!token) {
      throw new Error(`STS returned no web identity token for audience ${audience}`)
    }

    logger.info({ audience, expiration }, 'Issued STS web identity token')

    return {
      token,
      expiresAt: expiration?.getTime() ?? Date.now() + this.durationSeconds * 1000
    }
  }

  #getStsClient () {
    // The SDK creates its own https agent by default, which bypasses the
    // egress proxy that `--use-env-proxy` wires into the global agent.
    this.#stsClient ??= new clientSts.STSClient({
      requestHandler: { httpsAgent: Https.globalAgent }
    })

    return this.#stsClient
  }
}

/**
 * The cached token for a single audience.
 */
class CachedWebIdentityToken {
  #token = null
  #expiresAt = 0
  #refreshInFlight = null

  /**
   * @param {Object} options
   * @param {number} options.earlyRefreshMs
   * @param {() => Promise<{token: string, expiresAt: number}>} options.fetchToken
   */
  constructor ({ earlyRefreshMs, fetchToken }) {
    this.earlyRefreshMs = earlyRefreshMs
    this.fetchToken = fetchToken
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
    const { token, expiresAt } = await this.fetchToken()

    this.#token = token
    this.#expiresAt = expiresAt

    return token
  }
}

const defaultProvider = new WebIdentityTokenProvider(config.get('webIdentityToken'))

/**
 * Returns a web identity token for `audience` from the app-wide provider,
 * configured by `webIdentityToken`.
 *
 * @param {string} audience
 * @returns {Promise<string>}
 */
async function getWebIdentityToken (audience) {
  return defaultProvider.getToken(audience)
}

export { WebIdentityTokenProvider, getWebIdentityToken }
