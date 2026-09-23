const TEXT_TITLE = 'Title'
const TEXT_DOCUMENT_NAME = 'Document name'
const TEXT_LAST_MODIFIED = 'Last modified'
const TEXT_VERSION = 'Version'
const TEXT_ACTION = 'Action'
const CLASS_WIDTH_ONE_HALF = 'govuk-!-width-one-half'

const HEADS = {
  recent: [
    { text: TEXT_TITLE, classes: CLASS_WIDTH_ONE_HALF },
    { text: TEXT_LAST_MODIFIED },
    { text: TEXT_VERSION },
    { text: TEXT_ACTION }
  ],
  saved: [
    { text: TEXT_TITLE, classes: CLASS_WIDTH_ONE_HALF },
    { text: TEXT_LAST_MODIFIED },
    { text: TEXT_VERSION },
    { text: TEXT_ACTION }
  ],
  editing: [
    { text: TEXT_DOCUMENT_NAME, classes: CLASS_WIDTH_ONE_HALF },
    { text: TEXT_VERSION },
    { text: TEXT_LAST_MODIFIED },
    { html: `<span class="govuk-visually-hidden">${TEXT_ACTION}</span>` }
  ],
  'awaiting-approval': [
    { text: TEXT_DOCUMENT_NAME, classes: CLASS_WIDTH_ONE_HALF },
    { text: TEXT_VERSION },
    { text: 'Publishing checks' },
    { text: 'Changes requested' }
  ]
}

/**
 * Builds the GOV.UK table params for a list of guidance documents, or an
 * empty-state placeholder when there are none.
 *
 * @param {Array<object>} [items=[]]
 * @param {'recent'|'saved'|'editing'|'awaiting-approval'} [type='recent']
 * @returns {{isEmpty: boolean, count: number, head?: Array<object>, rows?: Array<Array<object>>}}
 */
function buildGuidanceTable (items = [], type = 'recent') {
  if (items.length === 0) {
    return {
      isEmpty: true,
      count: 0
    }
  }

  const head = HEADS[type] || HEADS.recent
  const rowMapper = _getRowMapper(type)

  return {
    isEmpty: false,
    count: items.length,
    head,
    rows: items.map(rowMapper)
  }
}

function _versionTag (version) {
  const color = Number(version) > 1 ? 'purple' : 'green'
  return `<strong class="govuk-tag govuk-tag--${color}">${version}</strong>`
}

function _getRowMapper (type) {
  switch (type) {
    case 'editing':
      return (item) => [
        {
          html: `<div class="govuk-!-margin-bottom-1"><strong class="govuk-tag govuk-tag--grey">Draft</strong></div><a class="govuk-link" href="${item.href}">${item.title}</a>`
        },
        { html: _versionTag(item.version) },
        { text: item.lastModified },
        {
          html: `<a class="govuk-link" href="${item.removeHref}">Remove<span class="govuk-visually-hidden"> ${item.title}</span></a>`
        }
      ]

    case 'awaiting-approval':
      return (item) => [
        {
          html: `<div class="govuk-!-margin-bottom-1"><strong class="govuk-tag govuk-tag--yellow">Awaiting approval</strong></div><a class="govuk-link" href="${item.href}">${item.title}</a>`
        },
        { html: _versionTag(item.version) },
        { text: item.publishingChecks ?? 'No issues' },
        { text: item.changesRequested ?? 'None' }
      ]

    case 'saved':
    case 'recent':
    default:
      return (item) => [
        {
          html: `<div class="govuk-!-margin-bottom-1"><strong class="govuk-tag govuk-tag--green">${item.status ?? 'Published'}</strong></div><a class="govuk-link" href="${item.href}">${item.title}</a>`
        },
        { text: item.lastModified },
        { html: _versionTag(item.version) },
        {
          html: `<a class="govuk-link" href="${item.removeHref}">Remove<span class="govuk-visually-hidden"> ${item.title}</span></a>`
        }
      ]
  }
}

export {
  HEADS,
  buildGuidanceTable
}
