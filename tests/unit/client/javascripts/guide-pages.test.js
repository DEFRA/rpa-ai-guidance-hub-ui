// @vitest-environment jsdom
import { initGuidePages } from '../../../../src/client/javascripts/guide-pages.js'

describe('a guide\'s page revealed by the browser\'s find in page', () => {
  const GUIDE_URL = '/guides/guide-1'

  /** A two-page guide in the layout, each part with a form that comes back to it. */
  function render () {
    const comesBack = `<form method="post"><input type="hidden" name="returnTo" value="${GUIDE_URL}"></form>`

    document.body.innerHTML = `
      ${comesBack}
      <div class="app-layout">
        <div class="app-layout__nav">${comesBack}</div>
        <div class="app-layout__main">
          <div class="app-shell">
            ${comesBack}
            <div data-guide-page="1" data-guide-page-href="${GUIDE_URL}"></div>
            <div data-guide-page="2" data-guide-page-href="${GUIDE_URL}?section=assign-case" hidden="until-found"></div>
          </div>
        </div>
      </div>`
  }

  beforeEach(() => {
    window.history.replaceState(null, '', GUIDE_URL)
    render()
    initGuidePages()
  })

  test('is where every form on the page comes back to, the side navigation\'s as well as the guide\'s', () => {
    document.querySelector('[data-guide-page="2"]').dispatchEvent(new window.Event('beforematch'))

    const returnTos = Array.from(document.querySelectorAll('input[name="returnTo"]')).map((input) => input.value)

    expect(returnTos).toEqual(Array(3).fill(`${GUIDE_URL}?section=assign-case`))
  })

  test('names the page in the address by its section', () => {
    document.querySelector('[data-guide-page="2"]').dispatchEvent(new window.Event('beforematch'))

    expect(window.location.search).toBe('?section=assign-case')
  })

  test('names a first page without a heading of its own by the guide\'s address alone', () => {
    window.history.replaceState(null, '', `${GUIDE_URL}?section=assign-case`)

    document.querySelector('[data-guide-page="1"]').dispatchEvent(new window.Event('beforematch'))

    expect(window.location.search).toBe('')
  })

  test('is shown, and the others hidden, when the search in the guide steps to a match on it', () => {
    const [first, second] = document.querySelectorAll('[data-guide-page]')

    second.dispatchEvent(new window.CustomEvent('guide-pages:show'))

    expect([first.getAttribute('hidden'), second.hasAttribute('hidden')]).toEqual(['until-found', false])
    expect(window.location.search).toBe('?section=assign-case')
  })
})

describe('the search in a guide, when another page of it is shown', () => {
  const GUIDE_URL = '/guides/guide-1'

  beforeEach(() => {
    window.history.replaceState(null, '', `${GUIDE_URL}?section=introduction&q=pay`)
    document.body.innerHTML = `
      <form data-guide-search>
        <input type="hidden" name="section" value="introduction">
        <input name="q" value="pay">
        <a href="${GUIDE_URL}?section=introduction" data-guide-search-clear>Clear search</a>
      </form>
      <div data-guide-page="1" data-guide-page-href="${GUIDE_URL}?q=pay"></div>
      <div data-guide-page="2" data-guide-page-href="${GUIDE_URL}?section=assign-case&q=pay" hidden="until-found"></div>`
    initGuidePages()
  })

  const sectionKept = () => document.querySelector('[data-guide-search] input[name="section"]')?.value ?? null
  const clearHref = () => document.querySelector('[data-guide-search-clear]').getAttribute('href')

  test('searches again, and clears, on that page', () => {
    document.querySelector('[data-guide-page="2"]').dispatchEvent(new window.Event('beforematch'))

    expect([sectionKept(), clearHref()]).toEqual(['assign-case', `${GUIDE_URL}?section=assign-case`])
  })

  test('names no section for a first page without a heading of its own', () => {
    document.querySelector('[data-guide-page="1"]').dispatchEvent(new window.CustomEvent('guide-pages:show'))

    expect([sectionKept(), clearHref()]).toEqual([null, GUIDE_URL])
  })
})
