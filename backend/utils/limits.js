// Centralized caps for user-supplied text fields. Kept in one file so every
// route guards against oversized JSON fields with the same numbers instead of
// each file inventing its own limit.
const LIMITS = {
  THREAD_FIELD: 2000,
  THREAD_VERSE: 2000,
  AFFIRMATION_FIELD: 1000,
  AFFIRMATION_REPLY: 1000,
  DEVOTIONAL_BOOK: 100,
  DEVOTIONAL_PASSAGE: 500,
  DEVOTIONAL_ESSAY: 2000,
  TICKET_TITLE: 150,
  TICKET_DESCRIPTION: 4000,
};

const tooLong = (value, key) => String(value ?? '').length > LIMITS[key];

module.exports = { LIMITS, tooLong };