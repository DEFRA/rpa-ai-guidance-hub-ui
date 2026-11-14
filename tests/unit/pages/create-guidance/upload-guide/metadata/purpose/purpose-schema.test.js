import { buildPurposeSchema } from '../../../../../../../src/pages/create-guidance/upload-guide/metadata/purpose/schemas/purpose-schema.js'
import { PURPOSE_MESSAGES } from '../../../../../../fixtures/messages.js'

const systemOptions = [{ label: 'CRM' }, { label: 'Siti Agri' }]
const audienceOptions = [{ label: 'Processor' }, { label: 'Team leader' }]

function validPayload (overrides = {}) {
  return {
    owner: 'owner@example.com',
    goal: 'Explains how to process a claim',
    requirements: 'CRM access',
    systems: ['CRM'],
    audience: ['Processor'],
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
    const { error, value } = validate(validPayload({ systems: 'CRM', audience: 'Team leader' }))

    expect(error).toBeUndefined()
    expect(value.systems).toEqual(['CRM'])
    expect(value.audience).toEqual(['Team leader'])
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
      PURPOSE_MESSAGES.ownerRequired,
      PURPOSE_MESSAGES.goalRequired,
      PURPOSE_MESSAGES.requirementsRequired,
      PURPOSE_MESSAGES.systemsRequired,
      PURPOSE_MESSAGES.audienceRequired
    ])
  })

  test('reports empty strings with the required messages', () => {
    expect(messages(validPayload({ owner: '', goal: ' ', requirements: '' }))).toEqual([
      PURPOSE_MESSAGES.ownerRequired,
      PURPOSE_MESSAGES.goalRequired,
      PURPOSE_MESSAGES.requirementsRequired
    ])
  })

  test('rejects an invalid email format', () => {
    expect(messages(validPayload({ owner: 'not-an-email' }))).toEqual([
      PURPOSE_MESSAGES.ownerFormat
    ])
  })

  test('accepts an email address with a non-public top level domain', () => {
    expect(validate(validPayload({ owner: 'owner@rpa.internal' })).error).toBeUndefined()
  })

  test('rejects a purpose longer than 200 characters', () => {
    expect(messages(validPayload({ goal: 'a'.repeat(201) }))).toEqual([
      PURPOSE_MESSAGES.goalTooLong
    ])
  })

  test('accepts a purpose of exactly 200 characters', () => {
    expect(validate(validPayload({ goal: 'a'.repeat(200) })).error).toBeUndefined()
  })

  test('rejects system and audience values that are not in the reference options', () => {
    expect(messages(validPayload({ systems: ['CRM', 'unknown'], audience: 'nobody' }))).toEqual([
      PURPOSE_MESSAGES.systemsRequired,
      PURPOSE_MESSAGES.audienceRequired
    ])
  })

  test('rejects empty selections', () => {
    expect(messages(validPayload({ systems: [], audience: [] }))).toEqual([
      PURPOSE_MESSAGES.systemsRequired,
      PURPOSE_MESSAGES.audienceRequired
    ])
  })

  test('throws when a reference option list is empty', () => {
    expect(() => buildPurposeSchema({ systemOptions: [], audienceOptions })).toThrow('No valid system options provided')
    expect(() => buildPurposeSchema({ systemOptions, audienceOptions: [] })).toThrow('No valid audience options provided')
  })
})
