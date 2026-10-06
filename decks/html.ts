/* ── Card HTML ──
   Cards are HTML, exactly as Anki stores them, and every card is sanitised at
   render time — imported, hand-typed and Alpha-wide alike. The import is not
   the boundary: a row can reach the table by any route the API allows, so the
   only safe place to filter is the last step before the page.

   An allow-list, not a block-list. Formatting, lists, tables, images; no
   attributes except an image's src/alt and the cloze markers this app writes
   itself. Links keep their text and lose their href — a flashcard that sends
   you somewhere is a flashcard that can send you anywhere. */

const ALLOWED = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUB', 'SUP', 'BR', 'P', 'DIV', 'SPAN',
  'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'CODE', 'PRE', 'IMG', 'HR',
]);
// Removed with everything inside them — their content is not text.
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'TITLE', 'HEAD', 'LINK', 'META', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'VIDEO']);

/** A bare media file name, as Anki writes it: no scheme, no slash, no "..". */
export const isMediaName = (src: string): boolean => /^[^\s/\\:?#]+\.(png|jpe?g|gif|webp|svg)$/i.test(src) && !src.includes('..');

const safeImage = (src: string): boolean =>
  /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src) || /^https:\/\//i.test(src) || isMediaName(src);

/**
 * Sanitise card HTML. `resolve` maps a bare media name to a URL (a signed URL
 * from the deck's folder); a name it cannot resolve becomes a labelled
 * placeholder instead of a broken-image icon.
 */
export const sanitize = (html: string, resolve: (name: string) => string | null = () => null): string => {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      const tag = el.tagName;
      if (DROP.has(tag)) { el.remove(); continue; }
      if (!ALLOWED.has(tag)) {
        // Unwrap: keep the children, lose the element (an <a>, a <font>…).
        walk(el);
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
      const cloze = tag === 'SPAN' ? el.getAttribute('data-cloze') : null;
      const hint = tag === 'SPAN' ? el.getAttribute('data-hint') : null;
      const size = tag === 'SPAN' ? el.getAttribute('data-size') : null;
      const sr = tag === 'SPAN' && el.hasAttribute('data-sr');
      const src = tag === 'IMG' ? (el.getAttribute('src') ?? '').trim() : '';
      const alt = tag === 'IMG' ? el.getAttribute('alt') ?? '' : '';
      for (const a of Array.from(el.attributes)) el.removeAttribute(a.name);
      if (cloze === 'hidden' || cloze === 'shown' || cloze === 'mark') {
        el.setAttribute('data-cloze', cloze);
        if (hint) el.setAttribute('data-hint', hint);
        if (size === 's' || size === 'm' || size === 'l') el.setAttribute('data-size', size);
      }
      // Text only a screen reader hears ("blank"), kept off the screen by CSS.
      if (sr) el.setAttribute('data-sr', '');
      if (tag === 'IMG') {
        const url = safeImage(src) ? (isMediaName(src) ? resolve(src) : src) : null;
        if (!url) {
          const ph = doc.createElement('span');
          ph.setAttribute('data-missing-image', '');
          ph.textContent = isMediaName(src) ? `Image not added yet · ${src}` : 'Image unavailable';
          el.replaceWith(ph);
          continue;
        }
        el.setAttribute('src', url);
        el.setAttribute('alt', alt.slice(0, 200));
        el.setAttribute('loading', 'lazy');
        el.setAttribute('referrerpolicy', 'no-referrer');
      }
      walk(el);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/**
 * Text content without a DOM — for hashing, search snippets and the import
 * preview, all of which also run where there is no DOMParser. Images are kept
 * as [img:name] so two cards that differ only by their picture are not
 * mistaken for duplicates.
 */
export const toPlain = (html: string): string =>
  html
    .replace(/<img\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi, ' [img:$1] ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|hr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();

/** The media names a note references, for the "drop the image files here" step. */
export const mediaNames = (html: string): string[] =>
  Array.from(html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)["']?/gi)).map(m => m[1]).filter(isMediaName);

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
