const TOOLTIP_DISMISSED_CLASS = 'app-side-nav__rail-item--tooltip-dismissed'

/**
 * Lets Esc dismiss a collapsed panel tooltip while it is hovered or focused.
 * @returns {void}
 */
function initRailTooltips () {
  const items = document.querySelectorAll('[data-side-nav-tooltip]')

  items.forEach((item) => {
    const reset = () => item.classList.remove(TOOLTIP_DISMISSED_CLASS)

    item.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        item.classList.add(TOOLTIP_DISMISSED_CLASS)
      }
    })
    item.addEventListener('blur', reset)
    item.addEventListener('mouseleave', reset)
  })

  if (items.length === 0) {
    return
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelector('[data-side-nav-tooltip]:hover')?.classList.add(TOOLTIP_DISMISSED_CLASS)
    }
  })
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
