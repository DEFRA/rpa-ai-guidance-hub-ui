import { submitOnChange } from '../../../../src/client/javascripts/hub-sort.js'

describe('submitOnChange', () => {
  test('sends the sort\'s form as soon as the sort changes', () => {
    const listeners = {}
    const select = {
      form: { submit: vi.fn() },
      addEventListener (type, listener) {
        listeners[type] = listener
      }
    }

    submitOnChange(select)
    listeners.change()

    expect(select.form.submit).toHaveBeenCalledTimes(1)
  })
})
