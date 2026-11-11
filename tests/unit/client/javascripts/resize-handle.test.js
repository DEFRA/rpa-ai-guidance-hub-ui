// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom'

import { clampWidth, initResizeHandles, keyedWidth } from '../../../../src/client/javascripts/resize-handle.js'

const LIMITS = { min: 220, max: 440 }

describe('keyedWidth', () => {
  test('widens by 20 pixels for the right arrow, and narrows by 20 for the left', () => {
    expect(keyedWidth('ArrowRight', 280, LIMITS)).toBe(300)
    expect(keyedWidth('ArrowLeft', 280, LIMITS)).toBe(260)
  })

  test('goes to the limits for Home and End', () => {
    expect(keyedWidth('Home', 280, LIMITS)).toBe(220)
    expect(keyedWidth('End', 280, LIMITS)).toBe(440)
  })

  test('keeps within the limits', () => {
    expect(keyedWidth('ArrowRight', 435, LIMITS)).toBe(440)
    expect(keyedWidth('ArrowLeft', 225, LIMITS)).toBe(220)
  })

  test('leaves the width alone for any other key', () => {
    expect(keyedWidth('Enter', 280, LIMITS)).toBeNull()
  })
})

describe('clampWidth', () => {
  test.each([
    [312.4, 312],
    [100, 220],
    [900, 440]
  ])('makes a dragged width of %s pixels %s', (width, clamped) => {
    expect(clampWidth(width, LIMITS)).toBe(clamped)
  })
})

describe('the side navigation\'s resize handle', () => {
  /** The open side navigation and its handle, as `layout.njk` makes them. */
  function render () {
    document.body.innerHTML = `
      <div class="app-layout">
        <div class="app-layout__nav" id="app-layout-nav"></div>
        <div class="app-layout__resize" role="separator" aria-orientation="vertical"
          aria-label="Resize navigation" aria-controls="app-layout-nav"
          aria-valuemin="220" aria-valuemax="440" aria-valuenow="280" aria-valuetext="280 pixels wide"
          data-side-nav-resize data-default-width="280" tabindex="0" hidden></div>
        <div class="app-layout__main"></div>
      </div>`

    initResizeHandles()

    return {
      layout: document.querySelector('.app-layout'),
      handle: screen.getByRole('separator', { name: 'Resize navigation' })
    }
  }

  /**
   * @param {Element} layout
   * @returns {string} The navigation's width, as the layout's custom property
   *   sets it
   */
  function navWidthOf (layout) {
    return layout.style.getPropertyValue('--app-side-nav-width')
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('shows once the script can move it', () => {
    const { handle } = render()

    expect(handle).toBeVisible()
  })

  test('widens the navigation by 20 pixels for each press of the right arrow, and says its new width', () => {
    const { layout, handle } = render()

    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    expect(navWidthOf(layout)).toBe('320px')
    expect(handle).toHaveAttribute('aria-valuenow', '320')
    expect(handle).toHaveAttribute('aria-valuetext', '320 pixels wide')
  })

  test('narrows the navigation to its least width for Home, and widens it to its most for End', () => {
    const { layout, handle } = render()

    fireEvent.keyDown(handle, { key: 'Home' })
    expect(navWidthOf(layout)).toBe('220px')

    fireEvent.keyDown(handle, { key: 'End' })
    expect(navWidthOf(layout)).toBe('440px')
  })

  test('follows the pointer while the edge is dragged, within the limits, marking the layout as resizing until it is let go', () => {
    const { layout, handle } = render()
    // jsdom has no pointer capture, which keeps the drag on the handle.
    handle.setPointerCapture = vi.fn()

    fireEvent.pointerDown(handle, { clientX: 280 })
    fireEvent.pointerMove(handle, { clientX: 330 })
    expect(navWidthOf(layout)).toBe('330px')
    expect(layout).toHaveClass('app-layout--resizing')

    fireEvent.pointerMove(handle, { clientX: 900 })
    expect(navWidthOf(layout)).toBe('440px')

    fireEvent.pointerUp(handle)
    expect(layout).not.toHaveClass('app-layout--resizing')
  })

  test('does not move the edge when the pointer moves without dragging it', () => {
    const { layout, handle } = render()

    fireEvent.pointerMove(handle, { clientX: 330 })

    expect(navWidthOf(layout)).toBe('')
    expect(handle).toHaveAttribute('aria-valuenow', '280')
  })

  test('puts the navigation back to its default width on a double-click', () => {
    const { layout, handle } = render()
    fireEvent.keyDown(handle, { key: 'End' })

    fireEvent.dblClick(handle)

    expect(navWidthOf(layout)).toBe('280px')
    expect(handle).toHaveAttribute('aria-valuenow', '280')
  })
})

describe('the contents column\'s resize handle', () => {
  /** A guide's reading column, its contents and their handle, as `guide/page.njk` makes them. */
  function render () {
    document.body.innerHTML = `
      <div class="app-guide-reading app-guide-reading--standard">
        <nav class="app-guide-contents" id="guide-contents" aria-label="Contents"></nav>
        <div class="app-guide-contents-resize" role="separator" aria-orientation="vertical"
          aria-label="Resize contents" aria-controls="guide-contents"
          aria-valuemin="240" aria-valuemax="560" aria-valuenow="340" aria-valuetext="340 pixels wide"
          data-guide-contents-resize data-default-width="340" tabindex="0" hidden></div>
      </div>`

    initResizeHandles()

    return {
      reading: document.querySelector('.app-guide-reading'),
      handle: screen.getByRole('separator', { name: 'Resize contents' })
    }
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  test('shows once the script can move it, and resizes the contents column within its own limits', () => {
    const { reading, handle } = render()

    fireEvent.keyDown(handle, { key: 'End' })

    expect(handle).toBeVisible()
    expect(reading.style.getPropertyValue('--app-guide-toc-width')).toBe('560px')
    expect(handle).toHaveAttribute('aria-valuetext', '560 pixels wide')
  })

  test('marks the reading column as resizing while the edge is dragged', () => {
    const { reading, handle } = render()
    // jsdom has no pointer capture, which keeps the drag on the handle.
    handle.setPointerCapture = vi.fn()

    fireEvent.pointerDown(handle, { clientX: 340 })
    fireEvent.pointerMove(handle, { clientX: 300 })

    expect(reading).toHaveClass('app-guide-reading--resizing')
    expect(reading.style.getPropertyValue('--app-guide-toc-width')).toBe('300px')
  })
})
