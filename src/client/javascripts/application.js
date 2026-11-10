import * as govukFrontend from 'govuk-frontend'

import { initGuideImages, initPanelHeight, initRailTooltips } from './guide.js'
import { initGuideContents } from './guide-contents.js'
import { initGuidePages } from './guide-pages.js'
import { initGuidePlace } from './guide-place.js'
import { initSortSelect } from './hub-sort.js'
import { initReorder } from './side-nav-reorder.js'
import { initResizeHandles } from './resize-handle.js'
import { initPolling } from './status-poll.js'

govukFrontend.initAll()

initPolling()
initRailTooltips()
initPanelHeight()
initGuideImages()
initGuidePages()
initGuidePlace()
initGuideContents()
initSortSelect()
initReorder()
initResizeHandles()
