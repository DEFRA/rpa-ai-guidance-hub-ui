import { dropIndex, movedMessage, moveTarget } from '../../../../src/client/javascripts/side-nav-reorder.js'

describe('dropIndex', () => {
  const MIDDLES = [110, 150, 190]

  test.each([
    [100, 0],
    [130, 1],
    [170, 2]
  ])('lands a guide dropped at %s pixels before the first of the others whose middle is below it, at %s', (clientY, index) => {
    expect(dropIndex(MIDDLES, clientY)).toBe(index)
  })

  test('lands a guide dropped below every other at the end', () => {
    expect(dropIndex(MIDDLES, 250)).toBe(3)
  })
})

describe('moveTarget', () => {
  test('moves a guide up or down by one', () => {
    expect(moveTarget(1, -1, 3)).toBe(0)
    expect(moveTarget(1, 1, 3)).toBe(2)
  })

  test('has nowhere to move the first guide up, or the last down', () => {
    expect(moveTarget(0, -1, 3)).toBeNull()
    expect(moveTarget(2, 1, 3)).toBeNull()
  })
})

describe('movedMessage', () => {
  test('tells a screen reader where a dragged guide now is, counting from one', () => {
    expect(movedMessage('Closing a case', 0, 3)).toBe('Moved Closing a case to position 1 of 3.')
  })
})
