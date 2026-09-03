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

  test('fromValidationError skips subsequent details for a field that already has an error', () => {
    const payload = { action: '' }
    const err = {
      details: [
        { path: ['action'], message: 'Select an action' },
        { path: ['action'], message: 'A second, duplicate error for the same field' }
      ]
    }

    const vm = ActionTypeViewModel.fromValidationError(payload, err)

    expect(vm.errors.action).toBe('Select an action')
    expect(vm.errorList).toEqual([{ text: 'Select an action', href: '#action' }])
  })

  test('_optionText falls back to the raw action key when there is no friendly label', () => {
    const vm = ActionTypeViewModel.empty()

    expect(vm._optionText('some-unmapped-action')).toBe('some-unmapped-action')
  })

  test('fromSubmissionError sets submissionError', () => {
    const vm = ActionTypeViewModel.fromSubmissionError({ action: 'migrate' }, 'Oops')
    expect(vm.submissionError).toBe('Oops')
  })
})
