import { buildPurposeSchema } from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/purpose/schemas/purpose-schema.js'

const systemOptions = [{ value: 'crm' }, { value: 'siti-agri' }]
const audienceOptions = [{ value: 'processor' }, { value: 'team-leader' }]

function validPayload (overrides = {}) {
  return {
    owner: 'owner@example.com',
    goal: 'Explains how to process a claim',
    requirements: 'CRM access',
    systems: ['crm'],
    audience: ['processor'],
    ...overrides
  }
}

function validate (payload) {
  return buildPurposeSchema({ systemOptions, audienceOptions }).validate(payload, { abortEarly: false })
}

function messages (payload) {
  return validate(payload).error.details.map((detail) => detail.message)
}

describe('#buildPurposeSchema', () => {
  test('accepts a fully valid payload', () => {
    const { error, value } = validate(validPayload())

    expect(error).toBeUndefined()
    expect(value).toEqual(validPayload())
  })

  test('accepts a single checked box submitted as a bare string', () => {
    const { error, value } = validate(validPayload({ systems: 'crm', audience: 'team-leader' }))

    expect(error).toBeUndefined()
    expect(value.systems).toEqual(['crm'])
    expect(value.audience).toEqual(['team-leader'])
  })

  test('trims text fields and normalizes CRLF line breaks in the purpose', () => {
    const { value } = validate(validPayload({ owner: ' owner@example.com ', goal: 'Line one\r\nLine two ' }))

    expect(value.owner).toBe('owner@example.com')
    expect(value.goal).toBe('Line one\nLine two')
  })

  test('reports every required field, in page order, for an empty payload', () => {
    const { error } = validate({})

    expect(error.details.map((detail) => detail.path[0])).toEqual([
      'owner', 'goal', 'requirements', 'systems', 'audience'
    ])
    expect(error.details.map((detail) => detail.message)).toEqual([
      'Enter an email address',
      'Enter what this guidance aims to achieve',
      'Enter what users need to perform or understand',
      'Select the systems this guidance uses',
      'Select who this guidance is for'
    ])
  })

  test('reports empty strings with the required messages', () => {
    expect(messages(validPayload({ owner: '', goal: ' ', requirements: '' }))).toEqual([
      'Enter an email address',
      'Enter what this guidance aims to achieve',
      'Enter what users need to perform or understand'
    ])
  })

  test('rejects an invalid email format', () => {
    expect(messages(validPayload({ owner: 'not-an-email' }))).toEqual([
      'Enter an email address in the correct format'
    ])
  })

  test('accepts an email address with a non-public top level domain', () => {
    expect(validate(validPayload({ owner: 'owner@rpa.internal' })).error).toBeUndefined()
  })

  test('rejects a purpose longer than 200 characters', () => {
    expect(messages(validPayload({ goal: 'a'.repeat(201) }))).toEqual([
      'Purpose must be 200 characters or fewer'
    ])
  })

  test('accepts a purpose of exactly 200 characters', () => {
    expect(validate(validPayload({ goal: 'a'.repeat(200) })).error).toBeUndefined()
  })

  test('rejects system and audience values that are not in the reference options', () => {
    expect(messages(validPayload({ systems: ['crm', 'unknown'], audience: 'nobody' }))).toEqual([
      'Select the systems this guidance uses',
      'Select who this guidance is for'
    ])
  })

  test('rejects empty selections', () => {
    expect(messages(validPayload({ systems: [], audience: [] }))).toEqual([
      'Select the systems this guidance uses',
      'Select who this guidance is for'
    ])
  })

  test('throws when a reference option list is empty', () => {
    expect(() => buildPurposeSchema({ systemOptions: [], audienceOptions })).toThrow('No valid system options provided')
    expect(() => buildPurposeSchema({ systemOptions, audienceOptions: [] })).toThrow('No valid audience options provided')
  })
})
