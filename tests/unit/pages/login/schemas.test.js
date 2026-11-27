import { describe, expect, test } from 'vitest'

import { callbackPayloadSchema } from '../../../../src/pages/login/schemas.js'

describe('#callbackPayloadSchema', () => {
  test('accepts a code and state', () => {
    const { error, value } = callbackPayloadSchema.validate({ code: 'a-code', state: 'a-state' })

    expect(error).toBeUndefined()
    expect(value).toEqual({ code: 'a-code', state: 'a-state' })
  })

  test('accepts an error and its description', () => {
    const { error } = callbackPayloadSchema.validate({ error: 'access_denied', error_description: 'User cancelled' })

    expect(error).toBeUndefined()
  })

  test('renames error_description to errorDescription', () => {
    const { error, value } = callbackPayloadSchema.validate({ error: 'access_denied', error_description: 'User cancelled' })

    expect(error).toBeUndefined()
    expect(value).toEqual({ error: 'access_denied', errorDescription: 'User cancelled' })
  })

  test('strips fields Entra may post that the hub does not use', () => {
    const { error, value } = callbackPayloadSchema.validate({ code: 'a-code', state: 'a-state', session_state: 'entra-session' })

    expect(error).toBeUndefined()
    expect(value).toEqual({ code: 'a-code', state: 'a-state' })
  })

  describe.each([
    ['code', 'code'],
    ['state', 'state'],
    ['error', 'error'],
    ['error_description', 'errorDescription']
  ])('the %s field', (field, key) => {
    test.each([
      ['a number', 12345],
      ['a boolean', true],
      ['null', null],
      ['an array', ['one', 'two']],
      ['an object', { nested: 'value' }]
    ])('is rejected when it is %s', (_description, value) => {
      const { error } = callbackPayloadSchema.validate({ [field]: value })

      expect(error).toBeDefined()
      expect(error.details[0].path).toEqual([key])
    })
  })
})
