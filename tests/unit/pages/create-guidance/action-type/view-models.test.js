import { describe, test, expect } from 'vitest'

import { ActionTypeViewModel } from '../../../../../src/pages/create-guidance/action-type/view-models.js'

describe('ActionTypeViewModel', () => {
  test('empty() creates an empty model', () => {
    const vm = ActionTypeViewModel.empty()

    expect(vm.values).toEqual({})
    expect(vm.errors).toEqual({})
    expect(Array.isArray(vm.actionOptions)).toBe(true)
  })

  test('fromSession populates values', () => {
    const vm = ActionTypeViewModel.fromSession({ action: 'migrate' })
    expect(vm.values.action).toBe('migrate')
  })

  test('fromValidationError extracts errors and errorList', () => {
    const payload = { action: '' }
    const err = { details: [{ path: ['action'], message: 'Select an action' }] }

    const vm = ActionTypeViewModel.fromValidationError(payload, err)

    expect(vm.errors.action).toBe('Select an action')
    expect(vm.errorList.length).toBeGreaterThan(0)
  })

  test('fromSubmissionError sets submissionError', () => {
    const vm = ActionTypeViewModel.fromSubmissionError({ action: 'migrate' }, 'Oops')
    expect(vm.submissionError).toBe('Oops')
  })
})
