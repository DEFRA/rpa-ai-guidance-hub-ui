import { countMatches } from '../../../../src/pages/guide/search-counts.js'
import { splitIntoSections } from '../../../../src/services/guide-sections.js'

describe('counting a search\'s matches in a guide', () => {
  test('counts the Introduction\'s matches once, and those under an underlined heading in the section it reads on in', () => {
    // "Late" is underlined, so the hub gives it no section of its own: the
    // search finds "Pay late." in the Claims section.
    const sections = splitIntoSections('Pay first.\n\n## Claims\n\nPay.\n\nLate\n----\n\nPay late.')
    const match = { start: 0, end: 3, text: 'Pay' }
    const found = { sections: [{ anchor: null, matches: [match] }, { anchor: 'claims', matches: [match, match] }] }

    const counted = countMatches(sections, new Set(['', 'claims', 'late']), found)

    expect(Object.fromEntries(counted.byEntry)).toEqual({ '': 1, claims: 2 })
    expect(counted.total).toBe(3)
  })
})
