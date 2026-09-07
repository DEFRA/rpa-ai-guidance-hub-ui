import * as designerDashboardController from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/designer/dashboard',
    handler: designerDashboardController.getDashboard
  }
]

export {
  routes
}
