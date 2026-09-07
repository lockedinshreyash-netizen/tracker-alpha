/**
 * Three compositions, not one composition scaled three ways.
 *
 * A 4:5 layout stretched to 9:16 puts a metre of dead space under the metrics
 * and pushes the footer into the region Instagram covers with its own UI. Each
 * ratio therefore states its own margins, type sizes and band heights; what is
 * shared is the *language* — the type roles, the hairline rule, the alignment,
 * the order things appear in — which lives in the draw functions.
 *
 * All numbers are logical units. The export scales the whole context once
 * (`render/index.ts`), so nothing here knows about device pixels.
 */

import { CardFormat } from '../types';

export interface FormatSpec {
  id: CardFormat;
  w: number;
  h: number;
  /** Side margin. The type column is `w - 2 * margin`. */
  margin: number;
  /** Baseline of the brand/meta row at the top. */
  topPad: number;
  /** Baseline of the footer row, measured up from the bottom. */
  bottomPad: number;

  /** Baseline of the hero numerals. */
  heroBaseline: number;
  /** Starting size for the hero; `fit` shrinks it if the figure is long. */
  hero: number;
  /** The Monthly hero is a serif and needs its own size to sit at the same weight. */
  heroSerif: number;

  /** Playfair italic line under the hero. */
  caption: number;
  /** Hero baseline → caption baseline. */
  captionGap: number;

  /** Uppercase metadata, and its tracking in ems. */
  meta: number;
  metaTrack: number;
  /** Line spacing inside the two-line top-right meta block. */
  metaLine: number;

  /** Caption baseline → the hairline rule. */
  ruleGap: number;
  /** Rule → metric value baseline. */
  metricGap: number;
  metricValue: number;
  metricLabel: number;
  /** Metric value baseline → metric label baseline. */
  metricLabelGap: number;

  /** Height of the chart band (weekly bars, monthly dots). */
  chart: number;
  /** Metric label baseline → top of the chart band. */
  chartGap: number;

  phrase: number;
  /** Leading for a phrase that wraps to two lines. */
  phraseLine: number;
  brand: number;
}

const SPECS: Record<CardFormat, FormatSpec> = {
  /* The primary card. The reference composition. */
  '4:5': {
    id: '4:5', w: 1080, h: 1350,
    margin: 84, topPad: 96, bottomPad: 92,
    heroBaseline: 470, hero: 228, heroSerif: 240,
    caption: 82, captionGap: 108,
    meta: 21, metaTrack: 0.1, metaLine: 32,
    ruleGap: 128, metricGap: 88,
    metricValue: 58, metricLabel: 19, metricLabelGap: 40,
    chart: 230, chartGap: 84,
    phrase: 23, phraseLine: 30, brand: 20,
  },

  /* Story. The extra height is not padding — the hero moves to the optical
     centre, the chart grows, and both ends carry a deep safe margin so the
     platform's own chrome never lands on the work. */
  '9:16': {
    id: '9:16', w: 1080, h: 1920,
    margin: 88, topPad: 190, bottomPad: 220,
    heroBaseline: 700, hero: 228, heroSerif: 240,
    caption: 84, captionGap: 112,
    meta: 22, metaTrack: 0.1, metaLine: 34,
    ruleGap: 160, metricGap: 96,
    metricValue: 60, metricLabel: 20, metricLabelGap: 42,
    chart: 350, chartGap: 120,
    phrase: 25, phraseLine: 32, brand: 21,
  },

  /* Square. Everything comes in one step; the chart shortens rather than the
     type shrinking, because the hero is the thing that has to survive a feed. */
  '1:1': {
    id: '1:1', w: 1080, h: 1080,
    margin: 78, topPad: 84, bottomPad: 78,
    heroBaseline: 396, hero: 200, heroSerif: 212,
    caption: 70, captionGap: 94,
    meta: 20, metaTrack: 0.1, metaLine: 30,
    ruleGap: 92, metricGap: 68,
    metricValue: 50, metricLabel: 18, metricLabelGap: 36,
    chart: 160, chartGap: 56,
    phrase: 22, phraseLine: 28, brand: 19,
  },
};

export const formatSpec = (format: CardFormat): FormatSpec => SPECS[format];

export const ALL_FORMATS: CardFormat[] = ['4:5', '9:16', '1:1'];
