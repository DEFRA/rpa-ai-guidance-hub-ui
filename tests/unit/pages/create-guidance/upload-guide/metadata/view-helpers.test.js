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
  test('uses each label as both the form value and the text', () => {
    expect(toCheckboxOptions([{ label: 'CRM' }, { label: 'Siti Agri', shortLabel: 'SA' }])).toEqual([
      { value: 'CRM', text: 'CRM' },
      { value: 'Siti Agri', text: 'Siti Agri' }
    ])
  })

  test('defaults to an empty array when no options are given', () => {
    expect(toCheckboxOptions()).toEqual([])
  })
})
