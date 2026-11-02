import { getConverted } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/converted',
    options: {
      app: { roleRequiredReason: 'review a converted guide' }
    },
    handler: getConverted
  }
]

export {
  routes
}
