import { isPanelCollapsed, setPanelCollapsed } from '../../../../src/pages/guide/panel.js'

function createRequest (stored) {
  const store = new Map(stored === undefined ? [] : [['guide-panel-collapsed', stored]])

  return {
    yar: { get: key => store.get(key), set: (key, value) => store.set(key, value) }
  }
}

describe('panel', () => {
  test('is open until it is collapsed', () => {
    expect(isPanelCollapsed(createRequest())).toBe(false)
  })

  test.each([[true], [false]])('remembers collapsed as %s', (collapsed) => {
    const request = createRequest()

    setPanelCollapsed(request, collapsed)

    expect(isPanelCollapsed(request)).toBe(collapsed)
  })

  test('is open for anything stored other than true', () => {
    expect(isPanelCollapsed(createRequest('true'))).toBe(false)
  })
})
