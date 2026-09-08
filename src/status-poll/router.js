import * as controller from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/status-poll/{uploadId}',
    handler: controller.getStatus
  },
  {
    method: 'GET',
    path: '/status-poll',
    handler: controller.getStatus
  }
]

const router = {
  plugin: {
    name: 'statusPollRouter',
    async register (server) {
      server.route(routes)
    }
  }
}

export { router }
