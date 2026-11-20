import { isBlock, isSkipped, SectionReader } from '../../../src/constants/search-places.js'

/** Feed the reader each character of a block, each placed at its index in the block. */
function block (reader, text) {
  Array.from(text).forEach((character, at) => reader.add(character, at))
  reader.endBlock()
}

describe('reading a guide as its search does', () => {
  test('reads a section a block at a time: its words with one space between them, a line between blocks', () => {
    const reader = new SectionReader()

    reader.section('2-paying')
    block(reader, '  2  Paying ')
    block(reader, 'Pay\tthe \n claim.')

    expect(reader.textOf('2-paying')).toBe('2 Paying\nPay the claim.')
  })

  test('leaves out a block with no words', () => {
    const reader = new SectionReader()

    reader.section('2-paying')
    block(reader, 'Paying')
    block(reader, '  ')
    block(reader, 'Pay')

    expect(reader.textOf('2-paying')).toBe('Paying\nPay')
  })

  test('starts each section afresh at its heading', () => {
    const reader = new SectionReader()

    reader.section(null)
    block(reader, 'Claims Guide')
    reader.section('1-paying')
    block(reader, 'Paying')

    expect([reader.textOf(null), reader.textOf('1-paying')]).toEqual(['Claims Guide', 'Paying'])
  })

  test('reads nothing while skipping, until the next section', () => {
    const reader = new SectionReader()

    reader.skip()
    block(reader, 'Introduction')
    reader.section('1-paying')
    block(reader, 'Paying')

    expect([reader.has(null), reader.textOf('1-paying')]).toEqual([false, 'Paying'])
  })

  test('takes a line break as a space', () => {
    const reader = new SectionReader()

    reader.section('a')
    reader.add('Pay', 0)
    reader.add(' ', null)
    reader.add('it', 1)
    reader.endBlock()

    expect(reader.textOf('a')).toBe('Pay it')
  })
})

describe('placing a match', () => {
  test('finds the places of the characters the API\'s positions cover, by character', () => {
    const reader = new SectionReader()
    reader.section('a')
    block(reader, '\u{1F642}  Pay it')

    expect(reader.placesOf('a', { start: 2, end: 5, text: 'Pay' })).toEqual([3, 4, 5])
  })

  test('places a run of spaces it closed up at the first of them', () => {
    const reader = new SectionReader()
    reader.section('a')
    block(reader, 'single  payment')

    expect(reader.placesOf('a', { start: 0, end: 14, text: 'single payment' })).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14])
  })

  test('places the line between blocks nowhere', () => {
    const reader = new SectionReader()
    reader.section('a')
    block(reader, 'Pay')
    block(reader, 'it')

    expect(reader.placesOf('a', { start: 0, end: 6, text: 'Pay\nit' })).toEqual([0, 1, 2, 0, 1])
  })

  test('does not place a match whose words there are not the API\'s', () => {
    const reader = new SectionReader()
    reader.section('a')
    block(reader, 'Pay the claim')

    expect(reader.placesOf('a', { start: 4, end: 7, text: 'Pay' })).toBeNull()
  })

  test('does not place a match in a section it has not read', () => {
    const reader = new SectionReader()

    expect(reader.placesOf('nowhere', { start: 0, end: 3, text: 'Pay' })).toBeNull()
  })
})

describe('which elements a search reads', () => {
  test.each(['p', 'li', 'h2', 'td', 'TH'])('starts a new block at %s', (tag) => {
    expect(isBlock(tag)).toBe(true)
  })

  test.each(['strong', 'a', 'span', 'mark', 'em'])('reads across %s', (tag) => {
    expect(isBlock(tag)).toBe(false)
  })

  test.each([
    ['script', {}],
    ['span', { class: 'govuk-visually-hidden' }],
    ['a', { class: 'app-guide-section-bookmark app-guide-section-bookmark--active' }],
    ['p', { class: 'app-guide-section-bookmarked' }],
    ['span', { class: 'app-guide-section-pin' }],
    ['svg', { 'aria-hidden': 'true' }]
  ])('skips %s %j, which is not the guide\'s own text', (tag, attributes) => {
    expect(isSkipped(tag, name => attributes[name] ?? null)).toBe(true)
  })

  test('reads the text in a link', () => {
    expect(isSkipped('a', name => ({ class: 'govuk-link' })[name] ?? null)).toBe(false)
  })
})
