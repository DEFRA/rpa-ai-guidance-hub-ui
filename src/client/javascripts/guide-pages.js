/**
 * @private
 * The search in the guide keeps to the page shown: searching again stays on
 * it, by its `section`, and clearing the search comes back to it.
 *
 * @param {URL} url - The page's address, as it is now
 */
function _keepSearchOnPage (url) {
  const form = document.querySelector('[data-guide-search]')

  if (!form) {
    return
  }

  _keepSection(form, url.searchParams.get('section'))

  const clear = form.querySelector('[data-guide-search-clear]')
  const cleared = new URL(url)

  cleared.searchParams.delete('q')
  clear?.setAttribute('href', `${cleared.pathname}${cleared.search}`)
}

/**
 * @private
 * @param {HTMLFormElement} form - The search in the guide
 * @param {string|null} section - The page's; null for a first page without a
 *   heading of its own
 */
function _keepSection (form, section) {
  const kept = form.querySelector('input[name="section"]')

  if (!section) {
    kept?.remove()
    return
  }

  const input = kept ?? document.createElement('input')

  input.type = 'hidden'
  input.name = 'section'
  input.value = section
  if (!kept) {
    form.prepend(input)
  }
}

/**
 * Makes a guide page current when the browser's find-in-page reveals a match
 * on it, or the search in the guide steps to one (`guide-pages:show`): hides
 * the other pages and updates the address, the contents, and where the
 * search in the guide stays and clears to.
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

    // Replace rather than push so each find hop is not a Back step. The
    // address names the page by its section, as its links do.
    const url = new URL(window.location.href)
    url.search = new URL(page.dataset.guidePageHref, url).search
    window.history.replaceState(window.history.state, '', url)

    // Every form on the page comes back to it, the side navigation's too
    document.querySelectorAll('input[name="returnTo"]')
      .forEach((input) => {
        input.value = `${url.pathname}${url.search}`
      })
    _keepSearchOnPage(url)

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
    page.addEventListener('guide-pages:show', () => showPage(page))
  })
}

export { initGuidePages }
