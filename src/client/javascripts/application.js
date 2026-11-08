import * as govukFrontend from 'govuk-frontend'

import { initGuideImages, initPanelHeight, initRailTooltips } from './guide.js'
import { initGuidePages } from './guide-pages.js'
import { initSortSelect } from './hub-sort.js'
import { initReorder } from './side-nav-reorder.js'
import { initPolling } from './status-poll.js'

govukFrontend.initAll()

initPolling()
initRailTooltips()
initPanelHeight()
initGuideImages()
initGuidePages()
initSortSelect()
initReorder()
