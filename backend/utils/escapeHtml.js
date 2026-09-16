// Escapes a value before it is interpolated into an email HTML template.
// User-controlled fields (display names, topics, descriptions) are stored
// verbatim, so without this a member could inject markup or image payloads
// into emails other members receive.
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

module.exports = { escapeHtml };