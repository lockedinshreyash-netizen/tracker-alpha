/**
 * MONTHLY — deep, monumental, reflective. "What did I build?"
 *
 * Two things set this card apart from its siblings on purpose. The hero is a
 * serif: a month is the one figure large enough to carry high-contrast type,
 * and it gives the card an identity without inventing a new colour or a new
 * layout. And the visualisation is a dot grid, which is the closest thing the
 * app has to a fingerprint — no two people's months are the same shape, and
 * that is what makes the shared image feel like it belongs to someone.
 */

import { Pen } from './primitives';
import { FormatSpec } from './format';
import { brandRow, column, footer, hero, MetricItem, metricRow } from './chrome';
import { MonthlyCard } from '../types';
import { formatCount, formatDuration } from '../stats';
import { heroCaption } from '../phrases';

/**
 * One dot per real day of the month, in three rows.
 *
 * Explicitly **not** a seven-column week grid — that is the contribution-graph
 * shape §12 rules out, and it also drags a calendar's worth of meaning
 * (weekends, alignment, empty leading cells) into something that only needs to
 * say "these are the days". Columns are derived from the month's real length,
 * so February is 28 dots and a ragged final row is simply how that month ended.
 */
const dots = (pen: Pen, spec: FormatSpec, top: number, data: MonthlyCard): void => {
  const rows = 3;
  const cols = Math.ceil(data.days.length / rows);
  const width = column(spec);

  const pitchX = width / cols;
  const usedRows = Math.ceil(data.days.length / cols);
  const pitchY = Math.min(pitchX, spec.chart / rows);
  const radius = Math.min(pitchX, pitchY) * 0.21;

  // Vertically centred in the band, so a short month does not sit high.
  const originY = top + (spec.chart - (usedRows - 1) * pitchY) / 2;

  data.days.forEach((level, i) => {
    const cx = spec.margin + (i % cols) * pitchX + pitchX / 2;
    const cy = originY + Math.floor(i / cols) * pitchY;

    if (level === 2) pen.circle(cx, cy, radius, pen.palette.mark);
    else if (level === 1) pen.circle(cx, cy, radius, pen.palette.markSoft);
    /* An empty day is an outline, never an absence: the grid has to stay a
       grid, or a slow month reads as a broken image rather than a slow month. */
    else pen.ring(cx, cy, radius, pen.palette.markEmpty, Math.max(1.5, radius * 0.16));
  });
};

export const drawMonthly = (pen: Pen, spec: FormatSpec, data: MonthlyCard): void => {
  brandRow(pen, spec, ['MONTHLY', `${data.monthName.toUpperCase()} ${data.year}`]);

  const captionY = hero(pen, spec, formatDuration(data.duration), heroCaption('monthly'), true);

  const ruleY = captionY + spec.ruleGap;
  pen.rule(spec.margin, ruleY, column(spec));

  const items: MetricItem[] = [
    {
      value: `${String(data.daysActive).padStart(2, '0')}/${String(data.totalDays).padStart(2, '0')}`,
      label: 'DAYS ACTIVE',
    },
  ];
  if (data.metric) items.push({ value: formatCount(data.metric.value), label: data.metric.label });
  if (data.change !== null) {
    items.push({
      value: `${Math.abs(data.change).toFixed(1)}%`,
      label: `VS ${data.prevMonthLabel}`,
      /* Exactly zero is neither direction. Two identical weeks get the
         figure and no marker — an up arrow on a flat result is a small lie. */
      rising: data.change > 0,
      falling: data.change < 0,
    });
  }

  const labelBaseline = metricRow(pen, spec, ruleY + spec.metricGap, items);
  dots(pen, spec, labelBaseline + spec.chartGap, data);

  footer(pen, spec, data.phrase);
};
