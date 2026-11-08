const TOOLTIP_DISMISSED_CLASS = 'app-side-nav__rail-item--tooltip-dismissed'

/**
 * Lets Esc dismiss a tooltip while its control is hovered or focused, until
 * the pointer leaves the control or it loses focus. The page listens for every
 * control, so one drawn later, as the guide viewer draws its headings'
 * controls, works the same.
 * @returns {void}
 */
function initRailTooltips () {
  const reset = (event) => {
    const item = _tooltipOf(event.target)

    if (item && !item.contains(event.relatedTarget)) {
      item.classList.remove(TOOLTIP_DISMISSED_CLASS)
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      [_tooltipOf(event.target), document.querySelector('[data-side-nav-tooltip]:hover')]
        .forEach((item) => item?.classList.add(TOOLTIP_DISMISSED_CLASS))
    }
  })
  document.addEventListener('focusout', reset)
  document.addEventListener('mouseout', reset)
}

/**
 * @param {EventTarget|null} target
 * @returns {Element|null} The control with a tooltip that `target` is in, if any
 */
function _tooltipOf (target) {
  return target instanceof window.Element ? target.closest('[data-side-nav-tooltip]') : null
}

/**
 * Keeps the guide panel within the window by setting `--app-side-nav-top` to
 * the part of the page above it that is still on screen.
 * @returns {void}
 */
function initPanelHeight () {
  const shell = document.querySelector('.app-shell')
  const panel = shell?.querySelector('.app-guide-panel')

  if (!panel) {
    return
  }

  let frame = null

  const sync = () => {
    frame = null
    const top = Math.max(0, panel.getBoundingClientRect().top)

    shell.style.setProperty('--app-side-nav-top', `${top}px`)
  }
  const requestSync = () => {
    frame ??= window.requestAnimationFrame(sync)
  }

  window.addEventListener('scroll', requestSync, { passive: true })
  window.addEventListener('resize', requestSync)
  sync()
}

/**
 * Marks guide images as `is-loaded` so the styles can reserve space for the
 * ones still loading.
 * @returns {void}
 */
function initGuideImages () {
  const root = document.querySelector('.app-guide-reading')

  if (!root) {
    return
  }

  root.classList.add('app-guide-reading--track-images')

  const markLoaded = (image) => image.classList.add('is-loaded')
  const onSettled = (event) => {
    if (event.target.tagName === 'IMG') {
      markLoaded(event.target)
    }
  }

  // `load` and `error` do not bubble, so capture them
  root.addEventListener('load', onSettled, true)
  root.addEventListener('error', onSettled, true)

  root.querySelectorAll('img').forEach((image) => {
    if (image.complete) {
      markLoaded(image)
    }
  })
}

export { initGuideImages, initPanelHeight, initRailTooltips }
