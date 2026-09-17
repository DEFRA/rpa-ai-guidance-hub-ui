import { mapValidationError } from '../../../../src/pages/create-guidance/form-errors.js'

describe('#mapValidationError', () => {
  test('maps each detail to an inline error and a summary link, defaulting the href to the field name', () => {
    const err = {
      details: [
        { path: ['owner'], message: 'Enter an email address' },
        { path: ['goal'], message: 'Enter what this guidance aims to achieve' }
      ]
    }

    expect(mapValidationError(err)).toEqual({
      errors: {
        owner: 'Enter an email address',
        goal: 'Enter what this guidance aims to achieve'
      },
      errorList: [
        { text: 'Enter an email address', href: '#owner' },
        { text: 'Enter what this guidance aims to achieve', href: '#goal' }
      ]
    })
  })

  test('keeps only the first error reported for a field', () => {
    const err = {
      details: [
        { path: ['owner'], message: 'First' },
        { path: ['owner'], message: 'Second' }
      ]
    }

    const { errors, errorList } = mapValidationError(err)

    expect(errors).toEqual({ owner: 'First' })
    expect(errorList).toEqual([{ text: 'First', href: '#owner' }])
  })

  test('uses the href map for fields whose anchor differs from their name', () => {
    const err = {
      details: [
        { path: ['guideTitle'], message: 'Enter the guidance title' },
        { path: ['schemes'], message: 'Select a scheme' }
      ]
    }

    const { errorList } = mapValidationError(err, { guideTitle: '#guide-title' })

    expect(errorList).toEqual([
      { text: 'Enter the guidance title', href: '#guide-title' },
      { text: 'Select a scheme', href: '#schemes' }
    ])
  })

  test('preserves the order details were reported in', () => {
    const err = {
      details: [
        { path: ['c'], message: 'C' },
        { path: ['a'], message: 'A' },
        { path: ['b'], message: 'B' }
      ]
    }

    expect(mapValidationError(err).errorList.map((error) => error.href)).toEqual(['#c', '#a', '#b'])
  })

  test('returns empty structures when there are no details', () => {
    expect(mapValidationError({ details: [] })).toEqual({ errors: {}, errorList: [] })
  })
})
