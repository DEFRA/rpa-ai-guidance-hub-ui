import { buildMetadataSchema } from '../../../../../../src/pages/create-guidance/upload-guide/metadata/schemas/metadata-schema.js'

const schemeOptions = [{ label: 'Sustainable Farming Incentive' }, { label: 'Not scheme-specific' }]

function validPayload (overrides = {}) {
  return {
    guideTitle: 'Processing farmer claims using RPA processors and legacy systems',
    versionNumber: '1.0',
    schemes: ['Sustainable Farming Incentive'],
    ...overrides
  }
}

describe('#buildMetadataSchema', () => {
  const metadataSchema = buildMetadataSchema(schemeOptions)

  test('accepts valid payload with valid scheme and title', () => {
    const result = metadataSchema.validate(validPayload())
    expect(result.error).toBeUndefined()
  })

  test('accepts a single scheme value that is not wrapped in an array', () => {
    const result = metadataSchema.validate(validPayload({ schemes: 'Sustainable Farming Incentive' }))
    expect(result.error).toBeUndefined()
  })

  test('accepts scheme "Not scheme-specific"', () => {
    const result = metadataSchema.validate(validPayload({ schemes: ['Not scheme-specific'] }))
    expect(result.error).toBeUndefined()
  })

  test('rejects missing or empty guideTitle', () => {
    const resultEmpty = metadataSchema.validate(validPayload({ guideTitle: '' }))
    expect(resultEmpty.error).toBeDefined()
    expect(resultEmpty.error.details[0].message).toBe('Enter the guidance title')

    const resultMissing = metadataSchema.validate({ schemes: ['sfi'] })
    expect(resultMissing.error).toBeDefined()
    expect(resultMissing.error.details[0].message).toBe('Enter the guidance title')
  })

  test('rejects guideTitle longer than 200 characters', () => {
    const result = metadataSchema.validate(validPayload({ guideTitle: 'a'.repeat(201) }))
    expect(result.error).toBeDefined()
    expect(result.error.details[0].message).toBe('Guidance title must be 200 characters or fewer')
  })

  test('rejects missing or invalid scheme', () => {
    const resultMissing = metadataSchema.validate(validPayload({ schemes: undefined }))
    expect(resultMissing.error).toBeDefined()
    expect(resultMissing.error.details[0].message).toBe('Select at least one scheme this guidance relates to')

    const resultInvalid = metadataSchema.validate(validPayload({ schemes: ['invalid-scheme'] }))
    expect(resultInvalid.error).toBeDefined()
    expect(resultInvalid.error.details[0].message).toBe('Select at least one scheme this guidance relates to')
  })

  describe('the version number', () => {
    const MALFORMED = 'Enter the version number as 2 whole numbers with a full stop between them, for example 1.0'

    test.each([[''], ['   '], [undefined]])('is asked for when it is %j', (versionNumber) => {
      const result = metadataSchema.validate(validPayload({ versionNumber }))

      expect(result.error.details[0].message).toBe('Enter the version number')
    })

    test.each([
      ['1'], ['1.'], ['.1'], ['1.0.0'], ['a.b'], ['1.x'], ['1,0'], ['-1.0'], ['+1.0'], ['1 .0'],
      ['\u0661.\u0660'], ['\u00b2.0'], ['1.\u00bd']
    ])('is refused as %j, not two whole numbers with a full stop between them', (versionNumber) => {
      const result = metadataSchema.validate(validPayload({ versionNumber }))

      expect(result.error.details[0].message).toBe(MALFORMED)
    })

    test.each([['1.0'], ['0.1'], ['12.3'], ['2024.10']])('is accepted as %s', (versionNumber) => {
      const result = metadataSchema.validate(validPayload({ versionNumber }))

      expect(result.error).toBeUndefined()
      expect(result.value.versionNumber).toBe(versionNumber)
    })

    test('is kept without the spaces around it', () => {
      expect(metadataSchema.validate(validPayload({ versionNumber: ' 1.0 ' })).value.versionNumber).toBe('1.0')
    })
  })

  test('builds a schema scoped to the options it is given', () => {
    const otherSchema = buildMetadataSchema([{ label: 'Other scheme' }])

    const result = otherSchema.validate(validPayload({ schemes: ['Sustainable Farming Incentive'] }))

    expect(result.error).toBeDefined()
    expect(result.error.details[0].message).toBe('Select at least one scheme this guidance relates to')
  })

  test('throws an error when no valid scheme options are provided', () => {
    expect(() => buildMetadataSchema([])).toThrow('No valid scheme options provided')
  })
})
