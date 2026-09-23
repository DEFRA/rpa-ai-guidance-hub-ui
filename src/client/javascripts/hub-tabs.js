function initHubTabs () {
  const tabButtons = document.querySelectorAll('.govuk-tabs__tab[data-tab-button]')
  if (!tabButtons.length) {
    return
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tabButton
      if (tabName) {
        const url = new URL(window.location)
        url.searchParams.set('tab', tabName)
        window.history.replaceState(null, '', url)
      }
    })
  })
}

export {
  initHubTabs
}
