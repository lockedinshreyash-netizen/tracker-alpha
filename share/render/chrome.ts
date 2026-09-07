/**
 * The parts every card has, drawn the same way on all three.
 *
 * The brief's hardest requirement is that the cards look like one system
 * without looking like one template. Everything in this file is the system —
 * the brand row, the hero and its serif caption, the hairline, the metric
 * track, the footer. Everything that differs (ground, hero face, which
 * visualisation sits in the middle, what the metrics are) stays in the card
 * files. A shared *renderer* rather than a shared *stylesheet* is what stops
 * the three drifting apart the third time one of them is adjusted.
 */

import { Pen } from './primitives';
import { FormatSpec } from './format';

const BRAND = 'TRACKER ALPHA';
const DOMAIN = 'trackeralpha.in';

/** Column the type is set in. */
export const column = (spec: FormatSpec): number => spec.w - spec.margin * 2;
export const right = (spec: FormatSpec): number => spec.w - spec.margin;

/**
 * `TRACKER ALPHA` left, the period and its dates right.
 *
 * The brand sits at the same size as the metadata rather than above it: it is
 * one more piece of technical detail about the card, not a masthead. §28 — the
 * card has to still work when someone crops this row off.
 */
export const brandRow = (pen: Pen, spec: FormatSpec, lines: string[]): void => {
  const meta = { track: spec.metaTrack, weight: 700 as const };
  pen.text(BRAND, spec.margin, spec.topPad, spec.meta, { ...meta, color: pen.palette.ink });

  lines.forEach((line, i) => {
    pen.text(line, right(spec), spec.topPad + i * spec.metaLine, spec.meta, {
      align: 'right',
      track: spec.metaTrack,
      weight: i === 0 ? 700 : 500,
      color: i === 0 ? pen.palette.ink : pen.palette.muted,
    });
  });
};

/**
 * The hero figure and the serif line under it.
 *
 * The figure is fit to the column, so `04:37:12` and `1247:14:38` are the same
 * composition at two sizes rather than one composition and one overflow.
 * Returns the caption's baseline, which is where the rest of the card starts.
 */
export const hero = (
  pen: Pen,
  spec: FormatSpec,
  value: string,
  caption: string,
  serif: boolean
): number => {
  const base = serif ? spec.heroSerif : spec.hero;
  const opts = { weight: serif ? 700 : 900, serif, track: serif ? -0.012 : -0.042 };
  const size = pen.fit(value, column(spec), base, base * 0.5, opts);
  pen.text(value, spec.margin, spec.heroBaseline, size, opts);

  const captionY = spec.heroBaseline + spec.captionGap;
  pen.text(caption, spec.margin, captionY, spec.caption, {
    serif: true,
    italic: true,
    weight: 400,
  });
  return captionY;
};

export interface MetricItem {
  value: string;
  label: string;
  /** Draws a small upward triangle before the value — the change figure. */
  rising?: boolean;
  falling?: boolean;
}

/**
 * The supporting metrics, on one track with hairline separators.
 *
 * Columns are their own natural width rather than an even division of the
 * card: two metrics that fill the full width read as a table, and a table is
 * the dashboard look the whole design is avoiding. Dropping a metric therefore
 * costs nothing — the row simply gets shorter, which is what makes the missing
 * comparison on a first week a non-event.
 *
 * Returns the label baseline.
 */
export const metricRow = (
  pen: Pen,
  spec: FormatSpec,
  valueBaseline: number,
  items: MetricItem[]
): number => {
  const labelBaseline = valueBaseline + spec.metricLabelGap;
  const gap = spec.metricValue * 0.95;
  const arrow = spec.metricValue * 0.40;

  let x = spec.margin;
  items.forEach((item, i) => {
    if (i > 0) {
      // Separator sits in the gap, spanning value and label together.
      const sx = x - gap / 2;
      pen.rect(sx, valueBaseline - spec.metricValue * 0.78, 1.5,
        spec.metricLabelGap + spec.metricValue * 0.78, pen.palette.rule);
    }

    let vx = x;
    if (item.rising || item.falling) {
      triangle(pen, vx, valueBaseline - spec.metricValue * 0.30, arrow, !!item.rising);
      vx += arrow * 1.34;
    }

    const vw = pen.text(item.value, vx, valueBaseline, spec.metricValue, {
      weight: 900, track: -0.025,
    });
    const lw = pen.text(item.label, x, labelBaseline, spec.metricLabel, {
      weight: 600, track: spec.metaTrack, color: pen.palette.muted,
    });

    x += Math.max(vx - x + vw, lw) + gap;
  });

  return labelBaseline;
};

/**
 * The direction marker on the change figure.
 *
 * Drawn rather than typed: `↑` is not in Satoshi's coverage and would fall back
 * to whatever the platform has, which on some devices is an emoji. A triangle
 * is three lines and renders identically everywhere.
 */
const triangle = (pen: Pen, x: number, y: number, size: number, up: boolean): void => {
  const { ctx } = pen;
  ctx.fillStyle = pen.palette.ink;
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x + size / 2, y - size * 0.62);
    ctx.lineTo(x + size, y + size * 0.30);
    ctx.lineTo(x, y + size * 0.30);
  } else {
    ctx.moveTo(x + size / 2, y + size * 0.30);
    ctx.lineTo(x, y - size * 0.62);
    ctx.lineTo(x + size, y - size * 0.62);
  }
  ctx.closePath();
  ctx.fill();
};

/**
 * Breaks a phrase into at most `maxLines` lines inside `maxWidth`.
 *
 * The micro-copy is set in the same small tracked uppercase as the metadata —
 * §4's "almost hidden", and the reference's treatment. Setting it in the serif
 * instead would give the card two editorial voices competing with the hero,
 * and the hero has to win.
 */
export const wrap = (
  pen: Pen,
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
  opts: Parameters<Pen['width']>[2] = {}
): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && pen.width(next, size, opts) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;

  /* Over budget: the tail is folded onto the last allowed line rather than
     dropped. The phrases are a fixed vocabulary, so this is a safety net for a
     narrow format, not a truncation the user could ever hit with real copy. */
  return [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')];
};

/**
 * The phrase bottom-left, the domain bottom-right.
 *
 * Both are set at metadata weight and the domain in muted — a card that shouts
 * its own URL is an advertisement, and §27 is explicit that the artifact comes
 * first. The `@lockedinshreyash` invitation deliberately lives in the share
 * sheet and never here.
 */
export const footer = (pen: Pen, spec: FormatSpec, phrase: string): void => {
  const opts = { track: spec.metaTrack, weight: 700 as const };
  const lines = wrap(pen, phrase.toUpperCase(), spec.phrase, column(spec) * 0.52, 3, opts);
  const firstBaseline = spec.h - spec.bottomPad - (lines.length - 1) * spec.phraseLine;

  lines.forEach((line, i) => {
    pen.text(line, spec.margin, firstBaseline + i * spec.phraseLine, spec.phrase, opts);
  });

  pen.text(DOMAIN, right(spec), spec.h - spec.bottomPad, spec.brand, {
    align: 'right',
    track: spec.metaTrack,
    weight: 500,
    color: pen.palette.muted,
  });
};
