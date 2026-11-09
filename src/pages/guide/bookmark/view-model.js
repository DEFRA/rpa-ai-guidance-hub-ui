/**
 * @module The question that bookmarks a section of a guide to a case: one
 * choice of four - an existing case, a new case, an existing SBI, a new SBI -
 * each revealing a list of the user's references of that type or a box to
 * type a new one in. The SBI choices are offered only when switched on; an
 * existing one only when there is one.
 */

import { CASE_TYPES } from '../../../constants/case-types.js'
import { keptReference } from '../../../services/case-bookmarks.js'
import { GuideViewModel } from '../view-model.js'

const UNTITLED = 'Untitled guide'

// The four choices, in order, each with the field its reveal holds.
const CHOICES = Object.freeze([
  { value: 'existing-case', text: 'Existing case', type: 'case', isExisting: true, field: 'existingCase' },
  { value: 'new-case', text: 'New case', type: 'case', isExisting: false, field: 'newCase' },
  { value: 'existing-sbi', text: 'Existing SBI', type: 'sbi', isExisting: true, field: 'existingSbi' },
  { value: 'new-sbi', text: 'New SBI', type: 'sbi', isExisting: false, field: 'newSbi' }
])

const NO_CHOICE = 'Select if you are bookmarking to an existing or new case ID or SBI application number'

// The radios' id prefix, as the page gives it; GOV.UK Frontend gives the first
// radio the prefix alone, and each other one its number after it.
const CHOICE_ID = 'bookmark-choice'

/**
 * @private
 * @param {Array<{type: string, ref: string}>} cases - The user's
 * @param {string} type
 * @returns {string[]} The references of that type, in the user's order
 */
function _refsOf (cases, type) {
  return cases.filter(each => each.type === type).map(each => each.ref)
}

/**
 * @private
 * @param {{type: string, isExisting: boolean}} choice
 * @param {Array<{type: string, ref: string}>} cases
 * @param {boolean} sbiBookmarks - Whether the SBI choices are switched on
 * @returns {boolean} Whether the choice can be made
 */
function _isOffered (choice, cases, sbiBookmarks) {
  return (choice.type !== 'sbi' || sbiBookmarks) && (!choice.isExisting || _refsOf(cases, choice.type).length > 0)
}

/**
 * The case the answer names, or what is wrong with it.
 *
 * @param {Object<string, string>} answer - The form's fields
 * @param {Array<{type: string, ref: string}>} cases - The user's
 * @param {boolean} sbiBookmarks - Whether the SBI choices are switched on
 * @returns {{type: string, ref: string}|{errors: Object<string, string>}}
 */
function chosenCase (answer, cases, sbiBookmarks) {
  const choice = CHOICES.find(each => each.value === answer.choice)

  if (!choice || !_isOffered(choice, cases, sbiBookmarks)) {
    return { errors: { choice: NO_CHOICE } }
  }

  const names = CASE_TYPES[choice.type]
  const text = answer[choice.field] ?? ''

  if (choice.isExisting) {
    return _refsOf(cases, choice.type).includes(text)
      ? { type: choice.type, ref: text }
      : { errors: { [choice.field]: `Select an existing ${names.lower}` } }
  }

  if (text.trim() === '') {
    return { errors: { [choice.field]: `Enter ${names.withArticle}` } }
  }

  const ref = keptReference(choice.type, text)

  return ref ? { type: choice.type, ref } : { errors: { [choice.field]: names.rule } }
}

/**
 * The guide's address at a section's heading, on the page that has it.
 *
 * @param {string} guideId
 * @param {{slug: string, page: number}} heading - As `findHeading` gives it
 * @returns {string}
 */
function sectionHref (guideId, heading) {
  return `${GuideViewModel.pageHref(guideId, heading.page)}#${heading.slug}`
}

class BookmarkViewModel {
  heading = 'Bookmark this section to a case'
  button = 'Bookmark section'

  /**
   * @param {Object} data
   * @param {{id: string, title: string|null}} data.guide
   * @param {{anchor: string, slug: string, title: string, page: number}} data.heading
   *   - The section being bookmarked, as `findHeading` gives it
   * @param {Array<{key: string, type: string, ref: string}>} data.cases - The user's
   * @param {boolean} data.sbiBookmarks - Whether the SBI choices are switched on
   * @param {Object<string, string>} [data.answer] - As given, to show again
   * @param {Object<string, string>} [data.errors] - By field
   */
  constructor ({ guide, heading, cases, sbiBookmarks, answer = {}, errors = {} }) {
    this.hint = `‘${heading.title}’ in ${guide.title ?? UNTITLED} will show under that case in the side navigation.`
    this.formAction = `/guides/${encodeURIComponent(guide.id)}/bookmark`
    this.section = heading.anchor
    // The cases the page offers, by key, which saving checks are still the
    // user's cases, so that a change made meanwhile saves nothing.
    this.shown = cases.map(each => each.key)
    this.cancelHref = sectionHref(guide.id, heading)
    this.chosen = answer.choice ?? null
    this.errors = errors
    this.choices = CHOICES.map(choice => ({
      ...choice,
      name: CASE_TYPES[choice.type].name,
      hint: CASE_TYPES[choice.type].hint,
      disabled: !_isOffered(choice, cases, sbiBookmarks),
      given: answer[choice.field] ?? '',
      refs: _refsOf(cases, choice.type)
    }))
    // An error about the choice goes to the first choice that can be made, as
    // a disabled radio cannot take focus.
    const firstOffered = this.choices.findIndex(choice => !choice.disabled)
    const choiceId = firstOffered === 0 ? CHOICE_ID : `${CHOICE_ID}-${firstOffered + 1}`
    const idOf = field => field === 'choice' ? choiceId : `bookmark-${field}`
    this.errorList = Object.entries(errors).map(([field, text]) => ({ text, href: `#${idOf(field)}` }))
    this.pageTitle = this.errorList.length ? `Error: ${this.heading}` : this.heading
  }
}

export {
  BookmarkViewModel,
  chosenCase,
  sectionHref
}
