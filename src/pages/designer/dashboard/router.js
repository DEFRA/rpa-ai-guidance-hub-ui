import * as designerDashboardController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/designer/dashboard',
    handler: designerDashboardController.getDashboard
  }
]

const designerDashboardRouter = {
  plugin: {
    name: 'designerDashboardRouter',
    register (server) {
      server.route(routes)
    }
  }
}

export { designerDashboardRouter }
