import { router } from '../../../src/status-poll/router.js'

describe('statusPollRouter', () => {
  test('registers polling routes on the server', async () => {
    const server = {
      route: vi.fn()
    }

    await router.plugin.register(server)

    expect(server.route).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ method: 'GET', path: '/status-poll/{uploadId}' }),
      expect.objectContaining({ method: 'GET', path: '/status-poll' })
    ]))
  })
})
