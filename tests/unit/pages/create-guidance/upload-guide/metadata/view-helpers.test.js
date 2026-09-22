import {
  formatStagedDocumentDate,
  labelsFor,
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
  test('maps label to text when no text is already present', () => {
    expect(toCheckboxOptions([{ value: 'crm', label: 'CRM' }])).toEqual([
      { value: 'crm', text: 'CRM' }
    ])
  })

  test('prefers a pre-mapped text over the label', () => {
    expect(toCheckboxOptions([{ value: 'crm', text: 'Custom', label: 'CRM' }])).toEqual([
      { value: 'crm', text: 'Custom' }
    ])
  })

  test('defaults to an empty array when no options are given', () => {
    expect(toCheckboxOptions()).toEqual([])
  })
})

describe('#labelsFor', () => {
  const options = [
    { value: 'sfi', label: 'Sustainable Farming Incentive (SFI)' },
    { value: 'none', label: 'Not scheme-specific' }
  ]

  test('resolves selected values to their labels', () => {
    expect(labelsFor(['sfi', 'none'], options)).toEqual([
      'Sustainable Farming Incentive (SFI)',
      'Not scheme-specific'
    ])
  })

  test('falls back to the raw value when the option list does not know it', () => {
    expect(labelsFor(['retired-scheme'], options)).toEqual(['retired-scheme'])
  })

  test('defaults to an empty array when no values or options are given', () => {
    expect(labelsFor()).toEqual([])
  })
})
