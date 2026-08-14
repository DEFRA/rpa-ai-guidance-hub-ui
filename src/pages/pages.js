import { homeRouter } from './home/router.js'
import { loginRouter } from './login/router.js'

const pageRouter = {
  plugin: {
    name: 'pageRouter',
    async register (server) {
      await server.register([homeRouter, loginRouter])
    }
  }
}

export { pageRouter }
