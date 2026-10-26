import Http from 'node:http'
import Https from 'node:https'

import { describe, expect, test } from 'vitest'

import Hapi from '@hapi/hapi'
import Wreck from '@hapi/wreck'

import { proxyAgents } from '../../../../src/server/plugins/proxy-agents.js'

describe('#proxyAgents', () => {
  test('Should point Wreck at the global http/https agents, so hapi packages honour the egress proxy', async () => {
    const server = Hapi.server()

    await server.register(proxyAgents)

    expect(Wreck.agents.http).toBe(Http.globalAgent)
    expect(Wreck.agents.https).toBe(Https.globalAgent)
  })
})
