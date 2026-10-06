import { getConverting } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/upload-guide/converting',
    handler: getConverting
  }
]

export {
  routes
}
