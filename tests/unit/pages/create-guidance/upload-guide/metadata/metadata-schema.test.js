import { buildMetadataSchema } from '../../../../../../src/pages/create-guidance/upload-guide/metadata/schemas/metadata-schema.js'

const schemeOptions = [{ label: 'Sustainable Farming Incentive' }, { label: 'Not scheme-specific' }]

function validPayload (overrides = {}) {
  return {
    guideTitle: 'Processing farmer claims using RPA processors and legacy systems',
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
    const resultMissing = metadataSchema.validate({ guideTitle: 'Test title' })
    expect(resultMissing.error).toBeDefined()
    expect(resultMissing.error.details[0].message).toBe('Select at least one scheme this guidance relates to')

    const resultInvalid = metadataSchema.validate(validPayload({ schemes: ['invalid-scheme'] }))
    expect(resultInvalid.error).toBeDefined()
    expect(resultInvalid.error.details[0].message).toBe('Select at least one scheme this guidance relates to')
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
