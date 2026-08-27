import {
  metadataSchema
} from '../../../../../src/pages/create-guidance/add-metadata/schemas/metadata-schema.js'

function validPayload (overrides = {}) {
  return {
    guidanceType: 'process',
    title: 'Submit your claim',
    intendedAudience: 'RPA caseworkers',
    intendedOutcome: 'Complete and submit the claim accurately',
    userPrerequisites: 'Understand claim eligibility criteria',
    requiresSystemAccess: 'no',
    systemAccessDetails: '',
    ...overrides
  }
}

describe('#metadataSchema', () => {
  test('rejects missing mandatory fields', () => {
    const result = metadataSchema.validate({}, { abortEarly: false })
    const messages = result.error.details.map((detail) => detail.message)

    expect(result.error).toBeDefined()
    expect(messages).toContain('Select the type of guidance')
    expect(messages).toContain('Enter the guidance title')
    expect(messages).toContain('Enter who this guidance is for')
    expect(messages).toContain('Enter what this guidance aims to achieve')
    expect(messages).toContain(
      'Enter what users need to perform or understand'
    )
    expect(messages).toContain(
      'Select whether users need access to any systems'
    )
  })

  test('requires system access details when requiresSystemAccess is yes', () => {
    const result = metadataSchema.validate(
      validPayload({
        requiresSystemAccess: 'yes',
        systemAccessDetails: ''
      }),
      { abortEarly: false }
    )

    expect(result.error).toBeDefined()
    expect(result.error.details.map((detail) => detail.message)).toContain(
      'Enter which systems users need access to'
    )
  })

  test('accepts a valid payload when requiresSystemAccess is yes with details', () => {
    const result = metadataSchema.validate(
      validPayload({
        requiresSystemAccess: 'yes',
        systemAccessDetails: 'Rural Payments service and SharePoint'
      }),
      { abortEarly: false }
    )

    expect(result.error).toBeUndefined()
  })

  test('accepts a valid payload when requiresSystemAccess is no', () => {
    const result = metadataSchema.validate(validPayload(), {
      abortEarly: false
    })

    expect(result.error).toBeUndefined()
  })
})
