// Render-time sanitizer for rich-text that was rendered through
// dangerouslySetInnerHTML (resource descriptions, etc). The API stores these
// HTML strings verbatim)Skip that — the backend stores them verbatim, so if a
// description ever carries a <script>, iframe or on* handler it is stripped
// here before it can reach the DOM.
//
// DOM-based (no regex, no parser dependency): the string is parsed through a
// <template> and walked with a TreeWalker, with a fixed tag/attribute
// allow-list and URL scheme check.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code',
  'pre', 'a', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
]);

const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'colspan', 'rowspan']);

const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

const sanitizeHtml = (html) => {
  const value = String(html ?? '');
  if (!value || typeof document === 'undefined') return value;

  const template = document.createElement('template');
  template.innerHTML = value;

  const elements = [];
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) elements.push(node);

  for (const element of elements) {
    const tag = element.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      // Drop the tag but keep its children (script bodies become inert text).
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();

      // Event handlers and unknown attributes are removed outright.
      if (name.startsWith('on') || !ALLOWED_ATTRS.has(name)) {
        element.removeAttribute(attr.name);
      }

      // href/src are only allowed if the URL resolves to a known-safe scheme.
      if (name === 'href' || name === 'src') {
        let protocol;
        try {
          protocol = new URL(attr.value, window.location.href).protocol;
        } catch {
          protocol = '';
        }
        if (!SAFE_URL_SCHEMES.has(protocol)) {
          element.removeAttribute(attr.name);
        }
      }
    }
  }

  return template.content.innerHTML;
};

export default sanitizeHtml;
