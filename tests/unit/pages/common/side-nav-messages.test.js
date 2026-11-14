import { SIDE_NAV_MESSAGES } from '../../../../src/pages/common/side-nav-messages.js'

describe('the side navigation\'s messages', () => {
  test('say a list is empty in these words', () => {
    expect(SIDE_NAV_MESSAGES).toEqual({
      nonePinned: "You haven't pinned any guidance yet.",
      noCaseBookmarks: "You haven't bookmarked any guidance to a case yet."
    })
  })
})
