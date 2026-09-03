import { routes } from '../../../../../src/pages/create-guidance/action-type/routes.js'
import { metadataSchema } from '../../../../../src/pages/create-guidance/action-type/schemas/action-schema.js'

describe('action-type routes', () => {
  test('registers GET and POST for /create-guidance/action-type', () => {
    const paths = routes.map((route) => ({ method: route.method, path: route.path }))

    expect(paths).toEqual(expect.arrayContaining([
      { method: 'GET', path: '/create-guidance/action-type' },
      { method: 'POST', path: '/create-guidance/action-type' }
    ]))
  })

  test('validates the POST payload against the action schema', () => {
    const post = routes.find((route) => route.method === 'POST')

    expect(post.options.validate.payload).toBe(metadataSchema)
  })
})
