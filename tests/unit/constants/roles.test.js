import { ROLES, knownRoles, roleDisplayNames } from '../../../src/constants/roles.js'

describe('roles', () => {
  test('knows the hub\'s three roles, in the hub\'s order', () => {
    expect(Object.values(ROLES)).toEqual(['Hub.Viewer', 'Hub.Editor', 'Hub.Admin'])
  })

  test.each([
    ['in the hub\'s order', ['Hub.Admin', 'Hub.Editor', 'Hub.Viewer'], ['Hub.Viewer', 'Hub.Editor', 'Hub.Admin']],
    ['without roles the hub does not know', ['Hub.Other', 'Hub.Viewer', 'toString'], ['Hub.Viewer']],
    ['once each', ['Hub.Viewer', 'Hub.Viewer'], ['Hub.Viewer']],
    ['as none for a session stored before roles', undefined, []]
  ])('knownRoles gives the roles %s', (_desc, roles, expected) => {
    expect(knownRoles(roles)).toEqual(expected)
  })

  test('roleDisplayNames names each role as the hub shows it, in its order', () => {
    expect(roleDisplayNames(['Hub.Admin', 'Hub.Editor', 'Hub.Viewer'])).toEqual(['Viewer', 'Designer', 'Administrator'])
  })
})
