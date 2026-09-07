/**
 * DAILY — dark, intimate, immediate. "What did I do today?"
 *
 * The simplest of the three and deliberately the emptiest: one figure, one
 * line, two metrics, and a great deal of nothing. A day does not need a chart —
 * it is a single number, and giving it a visualisation would be padding an
 * honest statement out to look like more.
 */

import { Pen } from './primitives';
import { FormatSpec } from './format';
import { brandRow, column, footer, hero, MetricItem, metricRow } from './chrome';
import { DailyCard } from '../types';
import { formatCount, formatDuration } from '../stats';
import { heroCaption } from '../phrases';

export const drawDaily = (pen: Pen, spec: FormatSpec, data: DailyCard): void => {
  brandRow(pen, spec, ['DAILY', data.dateLabel]);

  const captionY = hero(pen, spec, formatDuration(data.duration), heroCaption('daily'), false);

  const ruleY = captionY + spec.ruleGap;
  pen.rule(spec.margin, ruleY, column(spec));

  const items: MetricItem[] = [];
  if (data.metric) {
    items.push({
      /* Padded to two digits so it sets beside `02 SESSIONS` as a pair rather
         than as two unrelated numbers — the same reason a lap counter pads. */
      value: formatCount(data.metric.value).padStart(2, '0'),
      label: data.metric.label === 'TASKS' || data.metric.label === 'TASK'
        ? `${data.metric.label} COMPLETED`
        : data.metric.label,
    });
  }
  /* Sessions are always shown — they are the one thing a day always has a
     truthful answer for, including `00`, and they are what keeps the row from
     collapsing to a single figure on an account with no tasks or questions. */
  items.push({ value: String(data.sessions).padStart(2, '0'), label: 'SESSIONS' });

  metricRow(pen, spec, ruleY + spec.metricGap, items);

  footer(pen, spec, data.phrase);
};
