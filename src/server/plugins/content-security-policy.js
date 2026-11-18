import Blankie from 'blankie'

import { config } from '../../config/config.js'

// When a Google Tag Manager container ID is configured, analytics runs client
// side through Google, so the content security policy must permit scripts,
// navigation and images from Google and Tag Manager. The container ID is null
// outside analytics-enabled environments, leaving the policy untouched.
const gtmContainerId = config.get('googleTagManager.containerId')
const GA_DOMAIN = 'https://www.google-analytics.com'
const GTM_DOMAIN = 'https://www.googletagmanager.com'

const gtmScriptSrc = gtmContainerId ? [GTM_DOMAIN, GA_DOMAIN] : []
const gtmConnectSrc = gtmContainerId
  ? [
      GA_DOMAIN,
      'https://analytics.google.com',
      'https://region1.google-analytics.com'
    ]
  : []
const gtmImgSrc = gtmContainerId ? [GA_DOMAIN, GTM_DOMAIN] : []

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    // Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
    // https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy
    defaultSrc: ['self'],
    fontSrc: ['self', 'data:'],
    connectSrc: ['self', 'wss', 'data:', ...gtmConnectSrc],
    mediaSrc: ['self'],
    styleSrc: ['self'],
    scriptSrc: [
      'self',
      "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='",
      ...gtmScriptSrc
    ],
    imgSrc: ['self', 'data:', ...gtmImgSrc],
    frameSrc: ['self', 'data:'],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    formAction: ['self'],
    manifestSrc: ['self'],
    generateNonces: true
  }
}

export { contentSecurityPolicy }
