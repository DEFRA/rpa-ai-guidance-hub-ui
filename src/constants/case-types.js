/**
 * @module What each kind of case reference is called, wherever the hub
 * names one: a case ID, or an SBI application number.
 */

const CASE_TYPES = Object.freeze({
  case: Object.freeze({
    short: 'Case',
    name: 'Case ID',
    lower: 'case ID',
    withArticle: 'a case ID',
    hint: 'A letter followed by 7 numbers, for example W1234567',
    rule: 'Case ID must be a letter followed by 7 numbers'
  }),
  sbi: Object.freeze({
    short: 'SBI',
    name: 'SBI application number',
    lower: 'SBI application number',
    withArticle: 'an SBI application number',
    hint: '9 numbers, for example 123456789',
    rule: 'SBI application number must be 9 numbers, from 105000000 to 999999999'
  })
})

/**
 * The cases something is bookmarked to, named as the hub names them in a
 * line: `Case W1234567, SBI 123456789`.
 *
 * @param {Array<{type: string, ref: string}>} cases
 * @returns {string}
 */
function namedCases (cases) {
  return cases.map(({ type, ref }) => `${CASE_TYPES[type].short} ${ref}`).join(', ')
}

export { CASE_TYPES, namedCases }
