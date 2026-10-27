/**
 * Logs an integration-test request in via the 'local' auth provider's dev
 * session shortcut (`loginAsDevUser` in `pages/login/controller.js`) - no
 * OAuth round-trip, no Entra fixtures required.
 *
 * Only meaningful while `AUTH_PROVIDER` is 'local' (the test default, see
 * `vitest.setup.js`) - under the 'entra' provider `/login` instead redirects
 * to Entra and sets no session.
 *
 * @param {import('@hapi/hapi').Server} server
 * @returns {Promise<string>} a `Cookie` header value carrying the
 * authenticated session, for use in subsequent `server.inject` calls
 */
async function loginAsDevUser (server) {
  const response = await server.inject({
    method: 'GET',
    url: '/login'
  })

  const cookies = response.headers['set-cookie'] ?? []

  return cookies.map((cookie) => cookie.split(';')[0]).join('; ')
}

export { loginAsDevUser }
