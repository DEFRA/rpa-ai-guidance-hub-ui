import * as govukFrontend from 'govuk-frontend'

import { initGuideImages, initPanelHeight, initRailTooltips } from './guide.js'
import { initGuidePages } from './guide-pages.js'
import { initPolling } from './status-poll.js'

govukFrontend.initAll()

initPolling()
initRailTooltips()
initPanelHeight()
initGuideImages()
initGuidePages()
