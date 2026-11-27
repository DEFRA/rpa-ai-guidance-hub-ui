import { buildMetadataSchema } from '../../../../../../src/pages/create-guidance/upload-guide/metadata/schemas/metadata-schema.js'
import { METADATA_MESSAGES } from '../../../../../fixtures/messages.js'

const schemeOptions = [{ label: 'Sustainable Farming Incentive' }, { label: 'Not scheme-specific' }]

function validPayload (overrides = {}) {
  return {
    guideTitle: 'Processing farmer claims using RPA processors and legacy systems',
    versionNumber: '1.0',
    schemes: ['Sustainable Farming Incentive'],
    ...overrides
  }
}

/**
 * Each answer's own rule, without asking the guidance API about the source
 * link: Joi runs that check only in `validateAsync`.
 */
function validateWithoutTheApi (schema, payload) {
  return schema.validate(payload, { externals: false })
}

describe('#buildMetadataSchema', () => {
  const metadataSchema = buildMetadataSchema(schemeOptions)

  test('accepts valid payload with valid scheme and title', () => {
    const result = validateWithoutTheApi(metadataSchema, validPayload())
    expect(result.error).toBeUndefined()
  })

  test('accepts a single scheme value that is not wrapped in an array', () => {
    const result = validateWithoutTheApi(metadataSchema, validPayload({ schemes: 'Sustainable Farming Incentive' }))
    expect(result.error).toBeUndefined()
  })

  test('accepts scheme "Not scheme-specific"', () => {
    const result = validateWithoutTheApi(metadataSchema, validPayload({ schemes: ['Not scheme-specific'] }))
    expect(result.error).toBeUndefined()
  })

  test('rejects missing or empty guideTitle', () => {
    const resultEmpty = validateWithoutTheApi(metadataSchema, validPayload({ guideTitle: '' }))
    expect(resultEmpty.error).toBeDefined()
    expect(resultEmpty.error.details[0].message).toBe(METADATA_MESSAGES.titleRequired)

    const resultMissing = validateWithoutTheApi(metadataSchema, { schemes: ['sfi'] })
    expect(resultMissing.error).toBeDefined()
    expect(resultMissing.error.details[0].message).toBe(METADATA_MESSAGES.titleRequired)
  })

  test('rejects guideTitle longer than 200 characters', () => {
    const result = validateWithoutTheApi(metadataSchema, validPayload({ guideTitle: 'a'.repeat(201) }))
    expect(result.error).toBeDefined()
    expect(result.error.details[0].message).toBe(METADATA_MESSAGES.titleTooLong)
  })

  test('rejects missing or invalid scheme', () => {
    const resultMissing = validateWithoutTheApi(metadataSchema, validPayload({ schemes: undefined }))
    expect(resultMissing.error).toBeDefined()
    expect(resultMissing.error.details[0].message).toBe(METADATA_MESSAGES.schemeRequired)

    const resultInvalid = validateWithoutTheApi(metadataSchema, validPayload({ schemes: ['invalid-scheme'] }))
    expect(resultInvalid.error).toBeDefined()
    expect(resultInvalid.error.details[0].message).toBe(METADATA_MESSAGES.schemeRequired)
  })

  describe('the version number', () => {
    test.each([[''], ['   '], [undefined]])('is asked for when it is %j', (versionNumber) => {
      const result = validateWithoutTheApi(metadataSchema, validPayload({ versionNumber }))

      expect(result.error.details[0].message).toBe(METADATA_MESSAGES.versionNumberRequired)
    })

    test.each([
      ['1'], ['1.'], ['.1'], ['1.0.0'], ['a.b'], ['1.x'], ['1,0'], ['-1.0'], ['+1.0'], ['1 .0'],
      ['\u0661.\u0660'], ['\u00b2.0'], ['1.\u00bd']
    ])('is refused as %j, not two whole numbers with a full stop between them', (versionNumber) => {
      const result = validateWithoutTheApi(metadataSchema, validPayload({ versionNumber }))

      expect(result.error.details[0].message).toBe(METADATA_MESSAGES.versionNumberFormat)
    })

    test.each([['1.0'], ['0.1'], ['12.3'], ['2024.10']])('is accepted as %s', (versionNumber) => {
      const result = validateWithoutTheApi(metadataSchema, validPayload({ versionNumber }))

      expect(result.error).toBeUndefined()
      expect(result.value.versionNumber).toBe(versionNumber)
    })

    test('is kept without the spaces around it', () => {
      expect(validateWithoutTheApi(metadataSchema, validPayload({ versionNumber: ' 1.0 ' })).value.versionNumber).toBe('1.0')
    })
  })

  test('builds a schema scoped to the options it is given', () => {
    const otherSchema = buildMetadataSchema([{ label: 'Other scheme' }])

    const result = validateWithoutTheApi(otherSchema, validPayload({ schemes: ['Sustainable Farming Incentive'] }))

    expect(result.error).toBeDefined()
    expect(result.error.details[0].message).toBe(METADATA_MESSAGES.schemeRequired)
  })

  test('throws an error when no valid scheme options are provided', () => {
    expect(() => buildMetadataSchema([])).toThrow('No valid scheme options provided')
  })

  describe('source link', () => {
    test('is asked about only when one is given', async () => {
      const refusalOf = vi.fn()

      await buildMetadataSchema(schemeOptions, refusalOf).validateAsync(validPayload({ sourceLink: '' }))

      expect(refusalOf).not.toHaveBeenCalled()
    })

    test.each([
      ['not-sharepoint', METADATA_MESSAGES.sourceLinkNotSharepoint],
      ['not-a-word-document', METADATA_MESSAGES.sourceLinkNotAWordDocument]
    ])('refused as %s says why and how to get the right one', async (refusal, message) => {
      const schema = buildMetadataSchema(schemeOptions, async () => refusal)

      await expect(schema.validateAsync(validPayload({ sourceLink: 'https://www.gov.uk/claims' }))).rejects.toThrow(message)
    })
  })
})
