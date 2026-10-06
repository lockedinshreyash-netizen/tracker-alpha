/* ── The card field ──
   Students write sentences, not markup. A cloze here is a chip — the hidden
   words, tinted in the deck's colour, with the number of the card that hides
   them — and formatting is formatting. What is stored is unchanged: the
   field serialises to the same HTML-with-{{c1::…}} string the importer reads
   and the exporter writes, so nothing about portability depends on this
   screen.

   Built on contenteditable with discipline, because the alternatives cannot
   show a chip: a textarea can only show the markup, and an overlay mirror
   cannot hide characters that still take up width. The discipline:
   - Chips are contenteditable=false atoms. Backspace removes one whole; the
     chip's own popover edits its answer and hint, or unhides it.
   - Enter inserts <br>, never the browser's choice of <div> or <p>.
   - Paste is plain text. Formatting from a web page is not a card's.
   - The DOM is rebuilt from `value` only when `value` changes from outside
     (a reset after Save, a renumber) — never on the field's own input, or
     the caret would jump on every keystroke.
   - Everything that enters the DOM is filtered to the same allow-list as
     decks/html.ts: an imported card's HTML is not trusted here either. */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { parseCloze } from './cloze';
import { escapeHtml, isMediaName, mediaNames } from './html';
import { useMediaUrls } from './media';

export interface RichFieldApi {
  /** Hide the selection. Returns a message when there is nothing to hide. */
  cloze: (same: boolean) => string | null;
  format: (cmd: 'bold' | 'italic' | 'underline' | 'list') => void;
  insertImage: (name: string) => void;
  /** Open the hint editor on the most recent cloze. */
  hint: () => string | null;
  focus: () => void;
}

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  dark: boolean;
  accent: string;
  placeholder: string;
  clozes: boolean;
  deckId: string | null;
  minHeight: number;
  label: string;
  onSubmit?: () => void;
  onFocus?: () => void;
}

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUB', 'SUP', 'BR', 'DIV', 'P', 'SPAN', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'CODE', 'IMG']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT', 'TITLE', 'HEAD', 'LINK', 'META', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'VIDEO']);
const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const attr = (s: string) => escapeHtml(s).replace(/'/g, '&#39;');

const chipHtml = (n: number, answer: string, hint: string) =>
  `<span class="dk-chip" contenteditable="false" data-n="${n}" data-answer="${attr(answer)}" data-hint="${attr(hint)}"><span class="dk-chip-a">${answer}</span><span class="dk-chip-n">${n}</span></span>`;

/** The stored string as the field's DOM: clozes become chips, everything else is filtered. */
const toDom = (value: string, clozes: boolean, urls: Record<string, string>): string => {
  const raw = clozes
    ? parseCloze(value).segs.map(s => (s.t === 'text' ? s.v : chipHtml(s.n, s.answer, s.hint ?? ''))).join('')
    : value;
  const doc = new DOMParser().parseFromString(`<body>${raw}</body>`, 'text/html');
  const walk = (node: Node, inChip: boolean) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      if (DROP.has(el.tagName)) { el.remove(); continue; }
      if (!ALLOWED.has(el.tagName)) { walk(el, inChip); el.replaceWith(...Array.from(el.childNodes)); continue; }
      const isChip = !inChip && el.tagName === 'SPAN' && el.classList.contains('dk-chip');
      const isChipPart = inChip && el.tagName === 'SPAN' && (el.classList.contains('dk-chip-a') || el.classList.contains('dk-chip-n'));
      const keep: Record<string, string> = {};
      if (isChip) ['class', 'contenteditable', 'data-n', 'data-answer', 'data-hint'].forEach(a => { const v = el.getAttribute(a); if (v !== null) keep[a] = v; });
      if (isChipPart) keep.class = el.getAttribute('class') ?? '';
      const src = el.tagName === 'IMG' ? (el.getAttribute('src') ?? '').trim() : '';
      for (const a of Array.from(el.attributes)) el.removeAttribute(a.name);
      Object.entries(keep).forEach(([k, v]) => el.setAttribute(k, v));
      if (el.tagName === 'IMG') {
        const ok = isMediaName(src) || /^https:\/\//i.test(src) || /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(src);
        if (!ok) { el.remove(); continue; }
        el.setAttribute('data-src', src);
        el.setAttribute('src', isMediaName(src) ? urls[src] ?? BLANK_IMG : src);
        el.setAttribute('alt', '');
        if (isMediaName(src) && !urls[src]) el.setAttribute('data-pending', '');
      }
      walk(el, inChip || isChip);
    }
  };
  walk(doc.body, false);
  return doc.body.innerHTML;
};

const escText = (s: string) => s.replace(/ /g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The field's DOM back to the stored string. */
const serialize = (root: Node): string => {
  let out = '';
  root.childNodes.forEach(n => {
    if (n.nodeType === Node.TEXT_NODE) { out += escText(n.textContent ?? ''); return; }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    if (el.classList.contains('dk-chip')) {
      const h = el.dataset.hint;
      out += `{{c${el.dataset.n}::${el.dataset.answer ?? ''}${h ? `::${escText(h)}` : ''}}}`;
      return;
    }
    const tag = el.tagName;
    if (tag === 'BR') { out += '<br>'; return; }
    if (tag === 'IMG') { if (el.dataset.src) out += `<img src="${el.dataset.src}">`; return; }
    if (tag === 'B' || tag === 'STRONG') { out += `<b>${serialize(el)}</b>`; return; }
    if (tag === 'I' || tag === 'EM') { out += `<i>${serialize(el)}</i>`; return; }
    if (['U', 'S', 'SUB', 'SUP', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'CODE'].includes(tag)) {
      const t = tag.toLowerCase();
      out += `<${t}>${serialize(el)}</${t}>`;
      return;
    }
    if (tag === 'DIV' || tag === 'P') {
      const inner = serialize(el);
      out += `${out && !out.endsWith('<br>') && !out.endsWith('</ul>') && !out.endsWith('</ol>') ? '<br>' : ''}${inner === '<br>' ? '' : inner}`;
      return;
    }
    out += serialize(el);
  });
  return out;
};

const tidy = (s: string) => s.replace(/(<br>)+$/, '').replace(/^\s+|\s+$/g, '');

const maxOrd = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('.dk-chip')).reduce((m, c) => Math.max(m, Number(c.dataset.n) || 0), 0);

interface Pop { chip: HTMLElement; n: number; answer: string; hint: string; x: number; y: number; formatted: boolean }

const RichField = forwardRef<RichFieldApi, Props>(({ id, value, onChange, dark, accent, placeholder, clozes, deckId, minHeight, label, onSubmit, onFocus }, ref) => {
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const lastChip = useRef<number | null>(null);
  const [empty, setEmpty] = useState(!value);
  const [pop, setPop] = useState<Pop | null>(null);
  const names = Array.from(new Set(mediaNames(value)));
  const urls = useMediaUrls(deckId, names);
  const urlKey = Object.keys(urls).sort().join('|');

  const emit = useCallback(() => {
    if (!box.current) return;
    const v = tidy(serialize(box.current));
    emitted.current = v;
    setEmpty(!v);
    onChange(v);
  }, [onChange]);

  // Rebuild only when the value changed from outside, or the field switched
  // between showing chips and not — never on its own input.
  const builtClozes = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!box.current || (value === emitted.current && clozes === builtClozes.current)) return;
    box.current.innerHTML = toDom(value, clozes, urls);
    emitted.current = value;
    builtClozes.current = clozes;
    setEmpty(!value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, clozes]);

  // Signed image URLs arrive after the first render: swap them in place.
  useEffect(() => {
    box.current?.querySelectorAll<HTMLImageElement>('img[data-pending]').forEach(img => {
      const u = urls[img.dataset.src ?? ''];
      if (u) { img.src = u; img.removeAttribute('data-pending'); }
    });
  }, [urlKey, urls]);

  const selectionIn = (): Range | null => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !box.current) return null;
    const r = sel.getRangeAt(0);
    return box.current.contains(r.commonAncestorContainer) ? r : null;
  };

  const caretAfter = (node: Node) => {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  };

  useImperativeHandle(ref, () => ({
    focus: () => box.current?.focus(),
    cloze: (same: boolean) => {
      const root = box.current;
      if (!root) return null;
      const range = selectionIn();
      if (!range || range.collapsed) return 'Select the words you want to hide first.';
      const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement;
      if (startEl?.closest('.dk-chip')) return 'Those words are already hidden.';
      // Leave whitespace at the edges outside the cloze.
      const text = range.toString();
      const lead = text.length - text.replace(/^\s+/, '').length;
      const trail = text.length - text.replace(/\s+$/, '').length;
      if (range.startContainer.nodeType === Node.TEXT_NODE && lead && range.startOffset + lead <= (range.startContainer.textContent ?? '').length) range.setStart(range.startContainer, range.startOffset + lead);
      if (range.endContainer.nodeType === Node.TEXT_NODE && trail && range.endOffset - trail >= 0) range.setEnd(range.endContainer, range.endOffset - trail);
      if (range.collapsed) return 'Select the words you want to hide first.';
      const frag = range.cloneContents();
      if (frag.querySelector?.('.dk-chip')) return 'A hidden part can\'t go inside another one.';
      const holder = document.createElement('div');
      holder.appendChild(frag);
      const answer = tidy(serialize(holder));
      if (!answer.replace(/<[^>]*>/g, '').trim() && !answer.includes('<img')) return 'Select the words you want to hide first.';
      const n = same ? (lastChip.current ?? Math.max(1, maxOrd(root))) : maxOrd(root) + 1;
      range.deleteContents();
      const tmp = document.createElement('div');
      tmp.innerHTML = toDom(`{{c${n}::${answer}}}`, true, urls);
      const chip = tmp.firstElementChild as HTMLElement;
      range.insertNode(chip);
      // Give the caret somewhere to land after an atom at the end of a line.
      if (!chip.nextSibling || (chip.nextSibling.nodeType === Node.ELEMENT_NODE && (chip.nextSibling as HTMLElement).tagName === 'BR')) {
        chip.after(document.createTextNode(' '));
      }
      caretAfter(chip);
      lastChip.current = n;
      emit();
      return null;
    },
    format: cmd => {
      box.current?.focus();
      if (cmd === 'list') document.execCommand('insertUnorderedList');
      else document.execCommand(cmd);
      emit();
    },
    insertImage: (name: string) => {
      const root = box.current;
      if (!root) return;
      const range = selectionIn();
      const tmp = document.createElement('div');
      tmp.innerHTML = toDom(`<img src="${attr(name)}">`, false, urls);
      const img = tmp.firstElementChild;
      if (!img) return;
      if (range) { range.deleteContents(); range.insertNode(img); caretAfter(img); } else root.appendChild(img);
      emit();
    },
    hint: () => {
      const chips: HTMLElement[] = box.current ? Array.from(box.current.querySelectorAll<HTMLElement>('.dk-chip')) : [];
      const target = chips.find(c => Number(c.dataset.n) === lastChip.current) ?? chips[chips.length - 1];
      if (!target) return 'Hide some words first, then add a hint.';
      openPop(target);
      return null;
    },
  }), [emit, urls]);

  const openPop = (chip: HTMLElement) => {
    const w = wrap.current?.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    if (!w) return;
    const answer = chip.dataset.answer ?? '';
    lastChip.current = Number(chip.dataset.n);
    setPop({
      chip,
      n: Number(chip.dataset.n),
      answer: answer.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
      hint: chip.dataset.hint ?? '',
      x: Math.min(Math.max(0, c.left - w.left), Math.max(0, w.width - 300)),
      y: c.bottom - w.top + 8,
      formatted: /<[^>]+>/.test(answer),
    });
  };

  const updateChip = (p: Pop, patch: Partial<Pick<Pop, 'answer' | 'hint'>>) => {
    const next = { ...p, ...patch };
    if (patch.answer !== undefined && !p.formatted) {
      const html = escText(next.answer);
      p.chip.dataset.answer = html;
      const a = p.chip.querySelector('.dk-chip-a');
      if (a) a.textContent = next.answer;
    }
    if (patch.hint !== undefined) p.chip.dataset.hint = next.hint.replace(/[{}]/g, '');
    setPop(next);
    emit();
  };

  const unhide = (p: Pop) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = toDom(p.chip.dataset.answer ?? '', false, urls);
    p.chip.replaceWith(...Array.from(tmp.childNodes));
    setPop(null);
    emit();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Enter' && mod) { e.preventDefault(); onSubmit?.(); return; }
    if (e.key === 'Enter' && !e.shiftKey && !document.queryCommandState('insertUnorderedList')) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      emit();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  return (
    <div ref={wrap} className="relative">
      <div
        id={id}
        ref={box}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        data-empty={empty ? 'true' : 'false'}
        data-placeholder={placeholder}
        onInput={emit}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={onFocus}
        onMouseDown={e => {
          const chip = (e.target as HTMLElement).closest?.('.dk-chip') as HTMLElement | null;
          if (chip) { e.preventDefault(); openPop(chip); }
        }}
        className={`dk-rich w-full rounded-xl px-4 py-3.5 text-[17px] leading-[1.7] font-ui outline-none transition-shadow ${
          dark
            ? 'bg-white/[0.03] text-white ring-1 ring-inset ring-white/[0.08] focus:ring-white/[0.25]'
            : 'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:ring-zinc-400'}`}
        style={{
          minHeight,
          ['--dk-accent' as string]: accent,
          ['--dk-ph' as string]: dark ? '#3f3f46' : '#d4d4d8',
          ['--dk-chip-ink' as string]: dark ? '#fafafa' : '#09090b',
        }}
      />

      {pop && (
        <ChipPopover
          pop={pop}
          dark={dark}
          accent={accent}
          onAnswer={a => updateChip(pop, { answer: a })}
          onHint={h => updateChip(pop, { hint: h })}
          onUnhide={() => unhide(pop)}
          onClose={() => { setPop(null); box.current?.focus(); }}
        />
      )}
    </div>
  );
});
RichField.displayName = 'RichField';

const ChipPopover: React.FC<{
  pop: Pop; dark: boolean; accent: string;
  onAnswer: (a: string) => void; onHint: (h: string) => void; onUnhide: () => void; onClose: () => void;
}> = ({ pop, dark, accent, onAnswer, onHint, onUnhide, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    hintRef.current?.focus();
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.dk-chip')) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc, true); };
  }, [onClose]);
  const input = `w-full h-10 px-3 rounded-lg text-[14px] font-ui outline-none ${dark ? 'bg-white/[0.05] text-white ring-1 ring-inset ring-white/[0.08] focus:ring-white/[0.25] placeholder:text-zinc-600' : 'bg-zinc-50 text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:ring-zinc-400 placeholder:text-zinc-400'}`;
  const lab = `block text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Hidden part on card ${pop.n}`}
      className={`mk-sheet absolute z-20 w-[300px] p-4 rounded-2xl font-ui ${dark ? 'bg-[#1c1c21] ring-1 ring-white/[0.08] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.9)]' : 'bg-white ring-1 ring-zinc-200 shadow-[0_24px_60px_-20px_rgba(24,24,27,0.3)]'}`}
      style={{ left: pop.x, top: pop.y }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold" style={{ color: dark ? '#e4e4e7' : '#27272a' }}>
          <span className="dk-chip-n !ml-0" style={{ ['--dk-accent' as string]: accent }}>{pop.n}</span>
          Hidden on card {pop.n}
        </span>
        <button onClick={onClose} className={`text-[12px] font-bold ${dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Done</button>
      </div>
      <label className={lab}>Answer</label>
      <input className={input} value={pop.answer} onChange={e => onAnswer(e.target.value)} disabled={pop.formatted} title={pop.formatted ? 'This answer has formatting — edit it in the field.' : undefined} />
      <label className={`${lab} mt-3`}>Hint <span className="normal-case tracking-normal font-semibold opacity-70">· optional, shown in the blank</span></label>
      <input ref={hintRef} className={input} value={pop.hint} placeholder="e.g. reducing agent" onChange={e => onHint(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onClose(); }} />
      <button onClick={onUnhide} className={`mt-4 text-[12px] font-bold ${dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>Show these words again</button>
    </div>
  );
};

export default RichField;
