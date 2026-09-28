import { getStartOver, postStartOver } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/start-over',
    handler: getStartOver
  },
  {
    method: 'POST',
    path: '/create-guidance/start-over',
    handler: postStartOver
  }
]

export {
  routes
}
