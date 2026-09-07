/**
 * WEEKLY — light, analytical, performative. "How did I perform?"
 *
 * The most shareable of the three, and the only one that argues a case: seven
 * bars are what turn a total into a shape, and a shape is what makes a week
 * legible at a glance on someone else's feed.
 */

import { Pen } from './primitives';
import { FormatSpec } from './format';
import { brandRow, column, footer, hero, MetricItem, metricRow } from './chrome';
import { WeeklyCard } from '../types';
import { formatCount, formatDuration } from '../stats';
import { heroCaption } from '../phrases';

/**
 * Seven columns, square-cornered, on a hairline baseline.
 *
 * No gridlines, no legend, no rounded caps, no gradient — the chart is part of
 * the composition and has to read as drawn rather than as a library's default
 * output. The only axis furniture is two hairlines and seven three-letter days,
 * which is the least that still says what is being measured.
 */
const bars = (pen: Pen, spec: FormatSpec, top: number, data: WeeklyCard): void => {
  const width = column(spec);
  const labelGap = spec.metricLabel * 1.9;
  const plot = spec.chart - labelGap;

  const slot = width / (7 + 6 * 0.42);
  const gap = slot * 0.42;
  const peak = Math.max(1, ...data.bars.map(b => b.hours));

  // A faint ceiling and a firmer baseline: the band reads as a measured field.
  pen.rule(spec.margin, top, width, pen.palette.markEmpty);
  pen.rule(spec.margin, top + plot, width, pen.palette.rule);

  data.bars.forEach((bar, i) => {
    const x = spec.margin + i * (slot + gap);
    if (bar.hours > 0) {
      const h = Math.max(4, (bar.hours / peak) * (plot - 10));
      pen.rect(x, top + plot - h, slot, h, pen.palette.mark);
    } else {
      /* A day with nothing on it still gets a mark. A gap in the rhythm reads
         as a rendering fault; a sliver reads as zero, which is the truth. */
      pen.rect(x, top + plot - 3, slot, 3, pen.palette.markEmpty);
    }

    pen.text(bar.label, x + slot / 2, top + plot + labelGap * 0.72, spec.metricLabel * 0.86, {
      align: 'center',
      track: spec.metaTrack,
      weight: 600,
      color: pen.palette.muted,
    });
  });
};

export const drawWeekly = (pen: Pen, spec: FormatSpec, data: WeeklyCard): void => {
  brandRow(pen, spec, [`WEEK ${data.weekNumber}`, data.rangeLabel]);

  const captionY = hero(pen, spec, formatDuration(data.duration), heroCaption('weekly'), false);

  const ruleY = captionY + spec.ruleGap;
  pen.rule(spec.margin, ruleY, column(spec));

  const items: MetricItem[] = [
    {
      value: `${String(data.daysActive).padStart(2, '0')}/${String(data.totalDays).padStart(2, '0')}`,
      label: 'DAYS ACTIVE',
    },
  ];
  if (data.metric) items.push({ value: formatCount(data.metric.value), label: data.metric.label });
  /* No previous week means no comparison. The slot is dropped and the row
     simply ends earlier — printing `0%` would claim a flat week that never
     happened, and `—` would look like a bug. */
  if (data.change !== null) {
    items.push({
      value: `${Math.abs(data.change).toFixed(1)}%`,
      label: 'VS LAST WEEK',
      /* Exactly zero is neither direction. Two identical weeks get the
         figure and no marker — an up arrow on a flat result is a small lie. */
      rising: data.change > 0,
      falling: data.change < 0,
    });
  }

  const labelBaseline = metricRow(pen, spec, ruleY + spec.metricGap, items);
  bars(pen, spec, labelBaseline + spec.chartGap, data);

  footer(pen, spec, data.phrase);
};
