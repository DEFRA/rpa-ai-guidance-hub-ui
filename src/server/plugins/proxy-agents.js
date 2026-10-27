import Http from 'node:http'
import Https from 'node:https'

import Wreck from '@hapi/wreck'

/**
 * Points Wreck - the HTTP client many hapi packages use internally - at
 * Node's global http/https agents, instead of the dedicated agents it
 * creates for itself at import time.
 */
const proxyAgents = {
  plugin: {
    name: 'proxy-agents',
    register: () => {
      Wreck.agents.http = Http.globalAgent
      Wreck.agents.https = Https.globalAgent
    }
  }
}

export { proxyAgents }
