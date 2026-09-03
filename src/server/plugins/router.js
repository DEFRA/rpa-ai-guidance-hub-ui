import { router as healthRouter } from '../../health-probe/router.js'
import { router as statusPollRouter } from '../../status-poll/router.js'
import { pageRouter } from '../../pages/pages.js'

const router = {
  plugin: {
    name: 'router',
    async register (server) {
      await server.register([healthRouter, statusPollRouter, pageRouter])
    }
  }
}

export { router }
