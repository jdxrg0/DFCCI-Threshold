// Escapes every regex metacharacter in user input before it is interpolated
// into a $regex/$options query. Without this, a "search" field that accepts
// raw regex (e.g. "(a+)+" or ".*") is both a ReDoS source and a way for a
// caller to bypass the intended substring match.
const escapeRegex = (str) => String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegex };