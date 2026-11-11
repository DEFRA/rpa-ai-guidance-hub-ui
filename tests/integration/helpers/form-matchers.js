import { expect } from 'vitest'

/**
 * `expect(form).toSendInOrder(name, values)`: the form sends a field it
 * repeats with these values, in this order - as a Move form sends the order
 * the page showed. jest-dom's `toHaveFormValues` compares a repeated field as
 * a set, so it would pass a form that sends them in another order.
 *
 * @param {HTMLFormElement} form
 * @param {string} name
 * @param {Array<string>} expected
 * @returns {{pass: boolean, message: () => string}}
 */
function toSendInOrder (form, name, expected) {
  const received = [...form.elements].filter((element) => element.name === name).map((element) => element.value)

  return {
    pass: this.equals(received, expected),
    message: () => [
      this.utils.matcherHint(`${this.isNot ? '.not' : ''}.toSendInOrder`, 'form', 'name, values'),
      '',
      `Expected the form ${this.isNot ? 'not ' : ''}to send its "${name}" fields in this order:`,
      `  ${this.utils.printExpected(expected)}`,
      'Received:',
      `  ${this.utils.printReceived(received)}`
    ].join('\n')
  }
}

expect.extend({ toSendInOrder })
