/**
 * Sends the hub's sort as soon as it changes. Without this, "Apply filters"
 * sends it, since the sort belongs to the filter form.
 *
 * @param {HTMLSelectElement} select - In the form it sends (`form="…"`)
 * @returns {void}
 */
function submitOnChange (select) {
  select.addEventListener('change', () => select.form.submit())
}

/**
 * @returns {void}
 */
function initSortSelect () {
  document.querySelectorAll('[data-sort-select]').forEach(submitOnChange)
}

export { initSortSelect, submitOnChange }
