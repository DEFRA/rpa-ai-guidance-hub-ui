import { ROLES, roleDisplayNames } from '../../../src/constants/roles.js'

describe('roles', () => {
  test('knows the hub\'s three roles, in the hub\'s order', () => {
    expect(Object.values(ROLES)).toEqual(['Hub.Viewer', 'Hub.Editor', 'Hub.Admin'])
  })

  describe('roleDisplayNames', () => {
    test.each([
      [['Hub.Viewer'], ['Viewer']],
      [['Hub.Admin', 'Hub.Editor', 'Hub.Viewer'], ['Viewer', 'Designer', 'Administrator']],
      [['Hub.Admin', 'Hub.Viewer'], ['Viewer', 'Administrator']],
      [['Hub.Other', 'Hub.Viewer', 'toString'], ['Viewer']]
    ])('names %j, in the hub\'s order, as %j', (roles, expected) => {
      expect(roleDisplayNames(roles)).toEqual(expected)
    })
  })
})
