import { bookmarkedSections, keptReference } from '../../../src/services/case-bookmarks.js'
import { caseResponse } from '../../fixtures/guidance-api.js'

const GUIDE = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d90'
const OTHER_GUIDE = '0199b8a2-4c1e-7b3a-9d2f-6a1e3c5b7d91'

function bookmarked (section, position = 0) {
  return { sectionId: `019a0000-0000-7000-8000-00000000000${position}`, section, heading: section, position }
}

describe('keptReference', () => {
  test.each([
    ['case', 'W1234567', 'W1234567'],
    ['case', ' w1234567 ', 'W1234567'],
    ['sbi', '105000000', '105000000'],
    ['sbi', ' 999999999 ', '999999999']
  ])('keeps a %s of %j as %j', (type, text, kept) => {
    expect(keptReference(type, text)).toBe(kept)
  })

  test.each([
    ['case', 'W123456'],
    ['case', 'W12345678'],
    ['case', '12345678'],
    ['case', 'WW123456'],
    ['case', 'É1234567'],
    ['sbi', '104999999'],
    ['sbi', '012345678'],
    ['sbi', '1234567890'],
    ['sbi', 'A12345678'],
    ['crn', 'W1234567']
  ])('refuses a %s of %j', (type, text) => {
    expect(keptReference(type, text)).toBeNull()
  })
})

describe('bookmarkedSections', () => {
  test('names the cases each section of the guide is bookmarked to, in the user\'s order', () => {
    const cases = [
      caseResponse({ guides: [{ id: GUIDE, title: 'Guide', bookmarks: [bookmarked('1-one'), bookmarked('2-two', 1)] }] }),
      caseResponse({ key: '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4c', type: 'sbi', ref: '123456789', guides: [{ id: GUIDE, title: 'Guide', bookmarks: [bookmarked('1-one')] }] })
    ]

    expect(Object.fromEntries(bookmarkedSections(cases, GUIDE))).toEqual({
      '1-one': 'Case W1234567, SBI 123456789',
      '2-two': 'Case W1234567'
    })
  })

  test('leaves out the sections of other guides', () => {
    const cases = [caseResponse({ guides: [{ id: OTHER_GUIDE, title: 'Other', bookmarks: [bookmarked('1-one')] }] })]

    expect(bookmarkedSections(cases, GUIDE).size).toBe(0)
  })
})
