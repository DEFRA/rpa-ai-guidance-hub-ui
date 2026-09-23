const HEAD = [
  { text: 'Title' },
  { text: 'Last modified' },
  { text: 'Version' },
  { text: 'Action' }
]

/**
 * Builds the GOV.UK table params for a list of guidance documents, or an
 * empty-state placeholder when there are none.
 *
 * @param {Array<{title: string, href: string, lastModified: string, version: string|number, removeHref: string}>} [items=[]]
 * @returns {{isEmpty: boolean, count: number, emptyMessage?: string, head?: Array<object>, rows?: Array<Array<object>>}}
 */
function buildGuidanceTable (items = []) {
  if (items.length === 0) {
    return {
      isEmpty: true,
      count: 0
    }
  }

  return {
    isEmpty: false,
    count: items.length,
    head: HEAD,
    rows: items.map(_toRow)
  }
}

/**
 * @private
 *
 * Converts a guidance document item into a GOV.UK table row.
 *
 * @param {{title: string, href: string, lastModified: string, version: string|number, removeHref: string}} item
 * @returns {Array<object>}
 */
function _toRow (item) {
  return [
    { html: `<a class="govuk-link" href="${item.href}">${item.title}</a>` },
    { text: item.lastModified },
    { html: `<strong class="govuk-tag govuk-tag--green">${item.version}</strong>` },
    { html: `<a class="govuk-link" href="${item.removeHref}">Remove</a>` }
  ]
}

export {
  buildGuidanceTable
}
