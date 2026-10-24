/* ── What is in the box, in miniature ──
   Each thing a kit holds, drawn as the object it is everywhere else: a pack
   as its packaging (PackCard), a sheet as its page (SheetPaper), a deck as a
   small stack of cards. Used on the kit's page in the store ("What's in the
   box"), rising out of the box when it opens, and on the kit's page in Decks.
   `size` is the height of the slot; each object fits itself into it. */

import React from 'react';
import { PackCard } from '../../decks/store/PackCard';
import { deckAccent, room } from '../../decks/theme';
import { SheetPaper } from '../sheets/SheetPaper';
import type { KitItem } from '../types';

const KIND_LABEL: Record<KitItem['kind'], string> = { pack: 'Pack', sheet: 'Formula sheet', deck: 'Deck' };

/** "Pack · 412 cards", "Formula sheet · 62 formulas". */
export const itemLine = (i: KitItem): string =>
  `${KIND_LABEL[i.kind]} · ${i.count.toLocaleString()} ${i.kind === 'sheet' ? (i.count === 1 ? 'formula' : 'formulas') : i.count === 1 ? 'card' : 'cards'}`;

const DeckMini = ({ item, dark, h }: { item: KitItem; dark: boolean; h: number }) => {
  const r = room(dark);
  const w = Math.round(h * 0.74);
  const accent = deckAccent(item.subject, dark);
  const k = w / 120;
  return (
    <div className="relative font-ui" style={{ width: w, height: h }}>
      <div className="absolute rounded-xl border" style={{ left: 10 * k, right: 10 * k, top: 0, height: h * 0.9, background: r.layer2, borderColor: r.rule }} />
      <div className="absolute rounded-xl border" style={{ left: 5 * k, right: 5 * k, top: 4 * k, height: h * 0.92, background: r.layer, borderColor: r.rule }} />
      <div className="absolute rounded-xl border overflow-hidden" style={{ left: 0, right: 0, top: 8 * k, bottom: 0, background: r.card, borderColor: r.rule, padding: 11 * k }}>
        <div aria-hidden className="absolute inset-x-0 top-0" style={{ height: '45%', background: `linear-gradient(180deg, ${accent}${dark ? '22' : '18'}, transparent)` }} />
        <div className="relative" style={{ width: 22 * k, height: 4 * k, borderRadius: 2, background: accent }} />
        <p className="relative font-display line-clamp-3" style={{ fontSize: 15 * k, lineHeight: 1.1, marginTop: 9 * k, color: dark ? '#fafafa' : '#18181b' }}>{item.title}</p>
      </div>
    </div>
  );
};

interface Props {
  item: KitItem;
  dark: boolean;
  /** Height of the slot, in px. */
  size: number;
}

export const KitItemThumb = ({ item, dark, size }: Props) => {
  if (item.kind === 'pack') {
    const n = Math.max(1, item.decks ?? 1);
    const w = Math.round(size * 0.66);
    return (
      <PackCard
        pack={{
          title: item.title,
          packNo: item.packNo ?? 0,
          subject: item.subject,
          // Only the counts and the colour are drawn from these.
          decks: Array.from({ length: n }, (_, i) => ({ id: `${item.id}:${i}`, title: '', subject: item.subject, status: 'published', cards: i === 0 ? item.count : 0 })),
          examLine: null,
          access: 'free',
          priceInr: null,
          finish: item.finish ?? 'ink',
          status: item.status,
        }}
        w={w}
        h={size}
        style={{ ['--pk-shadow-o' as string]: dark ? 0.55 : 0.2 }}
      />
    );
  }
  if (item.kind === 'sheet') {
    return <SheetPaper sheet={{ title: item.title, sheetNo: 0, subject: item.subject, examLine: null }} entries={null} width={Math.round(size / Math.SQRT2)} lines={5} />;
  }
  return <DeckMini item={item} dark={dark} h={size} />;
};
