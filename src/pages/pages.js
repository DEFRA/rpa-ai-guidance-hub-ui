import { designerDashboardRouter } from './designer/dashboard/router.js'
import { homeRouter } from './home/router.js'
import { loginRouter } from './login/router.js'

const pageRouter = {
  plugin: {
    name: 'pageRouter',
    async register (server) {
      await server.register([
        designerDashboardRouter,
        homeRouter,
        loginRouter
      ])
    }
  }
}

export { pageRouter }
