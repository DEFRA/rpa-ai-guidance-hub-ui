/**
 * Makes a guide page current when the browser's find-in-page reveals a match
 * on it: hides the other pages and updates the address and contents.
 *
 * @returns {void}
 */
function initGuidePages () {
  const pages = Array.from(document.querySelectorAll('[data-guide-page]'))

  if (pages.length < 2) {
    return
  }

  function showPage (page) {
    pages.forEach((other) => {
      if (other !== page) {
        other.setAttribute('hidden', 'until-found')
      }
    })
    page.removeAttribute('hidden')

    const number = page.dataset.guidePage

    // Replace rather than push so each find hop is not a Back step
    const url = new URL(window.location.href)
    url.searchParams.set('page', number)
    window.history.replaceState(window.history.state, '', url)

    document.querySelectorAll('[data-guide-contents-page]').forEach((entry) => {
      const current = entry.dataset.guideContentsPage === number
      const link = entry.querySelector('a')

      entry.classList.toggle('app-guide-contents__section--current', current)

      if (current) {
        link.setAttribute('aria-current', 'page')
      } else {
        link.removeAttribute('aria-current')
      }
    })
  }

  pages.forEach((page) => {
    page.addEventListener('beforematch', () => showPage(page))
  })
}

export { initGuidePages }
