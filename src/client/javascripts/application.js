import * as govukFrontend from 'govuk-frontend'

import { initGuideImages, initRailTooltips } from './guide.js'
import { initGuideContents } from './guide-contents.js'
import { initGuideInfo } from './guide-info.js'
import { initGuidePages } from './guide-pages.js'
import { initGuidePlace } from './guide-place.js'
import { initGuideSearch } from './guide-search.js'
import { initFiltersToggle } from './hub-filters.js'
import { initSortSelect } from './hub-sort.js'
import { initSideNavDrawer } from './side-nav-drawer.js'
import { initSideNavLists } from './side-nav-lists.js'
import { initSideNavMenus } from './side-nav-menus.js'
import { initReorder } from './side-nav-reorder.js'
import { initResizeHandles } from './resize-handle.js'
import { initSearchAllGuides } from './search-shortcuts.js'
import { initPolling } from './status-poll.js'
import { initCookieBanner, initCookiesPage } from './cookie-consent.js'

govukFrontend.initAll()

initPolling()
initRailTooltips()
initGuideImages()
initGuidePages()
initGuidePlace()
initGuideContents()
initGuideInfo()
initGuideSearch()
initSearchAllGuides()
initSortSelect()
initFiltersToggle()
initReorder()
initSideNavLists()
initSideNavMenus()
initSideNavDrawer()
initResizeHandles()
initCookieBanner()
initCookiesPage()
