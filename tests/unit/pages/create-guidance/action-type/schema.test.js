import { describe, test, expect } from 'vitest'

import { metadataSchema } from '../../../../../src/pages/create-guidance/action-type/schemas/action-schema.js'

describe('action-schema', () => {
  test('missing action returns select message', () => {
    const res = metadataSchema.validate({}, { abortEarly: false })

    expect(res.error).toBeTruthy()
    expect(res.error.details[0].message).toContain('Select an action')
  })

  test('valid action passes', () => {
    const res = metadataSchema.validate({ action: 'migrate' })
    expect(res.error).toBeUndefined()
  })
})
