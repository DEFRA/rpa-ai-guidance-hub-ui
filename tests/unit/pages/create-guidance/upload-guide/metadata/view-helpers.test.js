import {
  formatStagedDocumentDate,
  toCheckboxOptions
} from '../../../../../../src/pages/create-guidance/upload-guide/metadata/view-helpers.js'

describe('#formatStagedDocumentDate', () => {
  test('formats an ISO date string for display', () => {
    expect(formatStagedDocumentDate('2026-05-10T12:00:00.000Z')).toBe('10 May 2026')
  })

  test('returns null for a missing date', () => {
    expect(formatStagedDocumentDate(null)).toBeNull()
    expect(formatStagedDocumentDate(undefined)).toBeNull()
  })

  test('returns null for an unparseable date', () => {
    expect(formatStagedDocumentDate('not-a-real-date')).toBeNull()
  })
})

describe('#toCheckboxOptions', () => {
  test('appends the short label in brackets to the text when it is distinct from the label', () => {
    expect(toCheckboxOptions([
      { label: 'Sustainable Farming Incentive', shortLabel: 'SFI' }
    ])).toEqual([
      { value: 'sustainable-farming-incentive', text: 'Sustainable Farming Incentive (SFI)' }
    ])
  })

  test('uses the label as the text when the short label is the same or missing', () => {
    expect(toCheckboxOptions([
      { label: 'CRM', shortLabel: 'CRM' },
      { label: 'Siti Agri' }
    ])).toEqual([
      { value: 'crm', text: 'CRM' },
      { value: 'siti-agri', text: 'Siti Agri' }
    ])
  })

  test('values are the lower-case, hyphenated label', () => {
    expect(toCheckboxOptions([
      { label: 'Siti Agri' },
      { label: 'Team leader (SFI)' }
    ]).map(({ value }) => value)).toEqual(['siti-agri', 'team-leader-sfi'])
  })

  test('defaults to an empty array when no options are given', () => {
    expect(toCheckboxOptions()).toEqual([])
  })
})
