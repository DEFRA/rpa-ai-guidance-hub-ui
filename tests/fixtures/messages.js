/**
 * The words of every message the UI shows: errors, empty lists, statuses and
 * notifications.
 *
 * Tests take a message's words from here, never from `src/`. A test that took
 * them from the code it checks would agree with that code whatever it said.
 * Each object has the name of the source object it restates. When a message's
 * words change in the source, the tests that find it fail until its words are
 * changed here too, so every message needs a test that finds it.
 *
 * A message the source builds from a template is written out here as the
 * sentences tests use, so nothing here repeats the source's logic.
 */

const HUB_MESSAGES = Object.freeze({
  noneMatch: 'No guides match your search or filters. Try removing some filters or using different search terms.',
  noneOpened: "You haven't opened any guidance yet. Any guidance you open will appear here.",
  nonePinned: 'You have not pinned any guidance yet. Select <strong>Pin guide</strong> on a guide, or the star next to a section heading, to add it here.',
  noneBookmarked: "You haven't bookmarked any guidance yet. Bookmark a section of a guide to add it here.",
  noGuides: 'There are no guides yet.'
})

const SIDE_NAV_MESSAGES = Object.freeze({
  nonePinned: "You haven't pinned any guidance yet.",
  noCaseBookmarks: "You haven't bookmarked any guidance to a case yet."
})

const BOOKMARK_MESSAGES = Object.freeze({
  noChoice: 'Select if you are bookmarking to an existing or new case ID or SBI application number',
  selectExistingCase: 'Select an existing case ID',
  enterCase: 'Enter a case ID',
  enterSbi: 'Enter an SBI application number',
  changedSince: 'Your case bookmarks changed while this page was open. Choose again.',
  casesUnreadable: 'The case bookmarks cannot be read'
})

const HEADING_BOOKMARK_MESSAGES = Object.freeze({
  bookmarkedToCase: 'Bookmarked to Case W1234567',
  bookmarkedToCaseAndSbi: 'Bookmarked to Case W1234567, SBI 123456789'
})

const UPLOAD_MESSAGES = Object.freeze({
  alreadyUploaded: 'You have already uploaded a document for this guide'
})

const UPLOAD_STEP_MESSAGES = Object.freeze({
  notChecked: 'The selected file could not be checked. Upload it again.',
  notUploaded: 'The selected file could not be uploaded. Upload a different file.',
  noFile: 'Select a Word document to upload.',
  notFound: 'Your upload could not be found. Upload the document again.',
  cannotOpen: 'This file cannot be opened',
  cannotOpenDetail: 'Check you selected the correct file and that it has not been corrupted, then upload it again. If this keeps happening, contact the support team.'
})

const METADATA_MESSAGES = Object.freeze({
  titleRequired: 'Enter the guidance title',
  titleTooLong: 'Guidance title must be 200 characters or fewer',
  versionNumberRequired: 'Enter the version number',
  versionNumberFormat: 'Enter the version number as 2 whole numbers with a full stop between them, for example 1.0',
  schemeRequired: 'Select at least one scheme this guidance relates to'
})

const PURPOSE_MESSAGES = Object.freeze({
  ownerRequired: 'Enter an email address',
  ownerFormat: 'Enter an email address in the correct format',
  goalRequired: 'Enter what this guidance aims to achieve',
  goalTooLong: 'Purpose must be 200 characters or fewer',
  requirementsRequired: 'Enter what users need to perform or understand',
  systemsRequired: 'Select the systems this guidance uses',
  audienceRequired: 'Select who this guidance is for'
})

/** Keyed by the guides service's result codes, as the source's object is. */
const REFUSAL_MESSAGES = Object.freeze({
  uploadExpired: 'The uploaded document has expired. Start again and upload it again',
  parsePending: 'The uploaded document is still being processed. Wait a few seconds, then select Convert document again',
  parseFailed: 'The uploaded document cannot be opened. Check you selected the correct file and that it has not been corrupted, then start over and upload it again. If this keeps happening, contact the support team'
})

const CONVERSION_MESSAGES = Object.freeze({
  failed: 'The document could not be converted',
  failedDetail: 'Go back to check your answers and select Convert document again. If this keeps happening, contact the support team',
  expired: 'The uploaded document has expired',
  expiredDetail: 'Start over and upload it again'
})

export {
  BOOKMARK_MESSAGES,
  CONVERSION_MESSAGES,
  HEADING_BOOKMARK_MESSAGES,
  HUB_MESSAGES,
  METADATA_MESSAGES,
  PURPOSE_MESSAGES,
  REFUSAL_MESSAGES,
  SIDE_NAV_MESSAGES,
  UPLOAD_MESSAGES,
  UPLOAD_STEP_MESSAGES
}
