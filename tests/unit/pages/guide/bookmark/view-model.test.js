import { CASE_TYPES } from '../../../../../src/constants/case-types.js'
import { BOOKMARK_MESSAGES } from '../../../../../src/pages/guide/bookmark/view-model.js'

describe('the bookmark page\'s messages', () => {
  test('say what is wrong with an answer, or a save, in these words', () => {
    expect({
      noChoice: BOOKMARK_MESSAGES.noChoice,
      selectExisting: BOOKMARK_MESSAGES.selectExisting(CASE_TYPES.case),
      enter: BOOKMARK_MESSAGES.enter(CASE_TYPES.sbi),
      changedSince: BOOKMARK_MESSAGES.changedSince,
      casesUnreadable: BOOKMARK_MESSAGES.casesUnreadable
    }).toEqual({
      noChoice: 'Select if you are bookmarking to an existing or new case ID or SBI application number',
      selectExisting: 'Select an existing case ID',
      enter: 'Enter an SBI application number',
      changedSince: 'Your case bookmarks changed while this page was open. Choose again.',
      casesUnreadable: 'The case bookmarks cannot be read'
    })
  })
})
