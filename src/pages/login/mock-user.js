// A fixed identity of its own: a tenant no Entra sign-in can have, so the
// hub keeps the mock user apart from anyone signing in for real.
const mockUser = {
  id: 'dev-user-123',
  tenantId: 'local-development',
  email: 'dev@example.com',
  displayName: 'Dev User',
  name: { familyName: 'User', givenName: 'Dev' },
  emails: [{ value: 'dev@example.com' }],
  mail: 'dev@example.com',
  mailNickname: 'dev',
  givenName: 'Dev',
  surname: 'User',
  userPrincipalName: 'dev@example.com'
}

export { mockUser }
