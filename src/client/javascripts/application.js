import * as govukFrontend from 'govuk-frontend'
import { initHubTabs } from './hub-tabs.js'
import { initPolling } from './status-poll.js'

govukFrontend.initAll()

initPolling()
initHubTabs()
