import { getStartOver, postStartOver } from './controller.js'

const routes = [
  {
    method: 'GET',
    path: '/create-guidance/start-over',
    options: {
      app: { roleRequiredReason: 'upload a new guide' }
    },
    handler: getStartOver
  },
  {
    method: 'POST',
    path: '/create-guidance/start-over',
    options: {
      app: { roleRequiredReason: 'upload a new guide' }
    },
    handler: postStartOver
  }
]

export {
  routes
}
