import { getConverted } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/converted',
    handler: getConverted
  }
]

export {
  routes
}
