import React, { useMemo } from 'react';
import { BUCKET_COUNT, DayGrid, bucketStart } from '../insight/buckets';
import { StudyWindow } from '../insight/windows';
import { DAY_START_HOUR } from '../utils';

interface Props {
  grid: DayGrid;
  best?: StudyWindow | null;
  labelled: boolean;
}

/* Hours on the chart, in wall-clock order. The day is drawn from 5 AM to
   2 AM — twenty-one bars rather than twenty-four, because 2–5 AM is empty for
   almost everyone and a chart that is one-eighth blank makes a real record look
   thinner than it is. Anything that does land there is folded into the last
   bar, so no measured time disappears. */
const FROM = 5;
const HOURS = 21;

const hourLabel = (h: number): string => {
  const hour = h % 24;
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
};

/**
 * When the student actually studies, as one clean bar per hour.
 *
 * This replaced a 48-spoke radial dial. The dial was more interesting to look
 * at and worse at its job: a student had to be taught to read it, and the thing
 * they wanted to know — *when do I actually work* — took a second look to find.
 * Twenty-one rounded bars along a normal left-to-right day answer it in one.
 *
 * The bars are deliberately chunky. A thin line reads as an instrument readout;
 * something with weight and a rounded cap reads as a thing made for a person.
 *
 * Every bar is real measured time. Nothing is smoothed, and the highlight only
 * appears once the evidence gates have actually opened.
 */
const WhenYouStudy: React.FC<Props> = ({ grid, best, labelled }) => {
  const hours = useMemo(() => {
    const out = new Array<number>(HOURS).fill(0);
    for (let i = 0; i < BUCKET_COUNT; i++) {
      const mins = grid.buckets[i].minutes;
      if (mins <= 0) continue;
      const wall = (DAY_START_HOUR * 60 + bucketStart(i)) % 1440;
      const hour = Math.floor(wall / 60);
      /* Anything before 5 AM belongs to the late end of the day, not the
         early end — a 1 AM session is somebody finishing, not starting. */
      const shifted = hour < FROM ? hour + 24 : hour;
      out[Math.min(HOURS - 1, Math.max(0, shifted - FROM))] += mins;
    }
    return out;
  }, [grid]);

  const anything = grid.totalMinutes > 0;

  /* A worked example, for a student who has recorded nothing yet. Fixed and
     invented — a plausible study day, not a projection of theirs — so it is
     drawn in outline and the card labels it. It is replaced entirely by the
     first real session. */
  const EXAMPLE = [0, 0, 20, 55, 60, 45, 10, 0, 25, 40, 30, 0, 15, 50, 60, 35, 20, 0, 0, 0, 0];
  const series = anything ? hours : EXAMPLE;
  const peak = Math.max(...series, 1);

  /* Which bars sit inside the named window.
     Both are put on the same 5 AM-based axis the chart is drawn on, then
     overlapped as plain intervals. Comparing raw wall-clock hours instead
     mis-highlights any window running past midnight, and — as the first
     version of this did — silently drops the hour a window opens in whenever
     it starts on a half hour, so a 9:00–11:30 finding lit up two bars while
     the sentence above it named three hours. */
  const bestBand = useMemo(() => {
    if (!labelled || !best) return null;
    const wallStart = (DAY_START_HOUR * 60 + best.start) % 1440;
    const from = wallStart < FROM * 60 ? wallStart + 1440 : wallStart;
    return { from, to: from + (best.end - best.start) };
  }, [labelled, best]);

  const inBest = (idx: number): boolean => {
    if (!bestBand) return false;
    const barFrom = (FROM + idx) * 60;
    return barFrom < bestBand.to && barFrom + 60 > bestBand.from;
  };

  return (
    <div>
      <div
        className={`flex items-end gap-[3px] md:gap-[5px] ${anything ? '' : 'o-ghost'}`}
        style={{ height: 150 }}
        role="img"
        aria-label={
          anything
            ? `Study time by hour of day across ${grid.dayCount} days.`
            : 'Example chart. Nothing recorded yet.'
        }
      >
        {series.map((mins, i) => {
          const h = mins > 0 ? Math.max(6, (mins / peak) * 150) : 4;
          const hot = anything && inBest(i);
          return (
            <div key={i} className="flex-1 flex items-end justify-center" style={{ height: '100%' }}>
              <div
                className={`o-bar w-full ${anything ? '' : 'o-ghost-bar'}`}
                style={{
                  height: h,
                  borderRadius: 7,
                  background: mins > 0 ? (hot ? 'var(--o-accent)' : 'var(--o-bar)') : 'var(--o-sunk)',
                  animationDelay: `${120 + i * 26}ms`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Four labels, evenly placed. More than that is noise on a phone. */}
      <div className={`flex mt-3 ${anything ? '' : 'o-ghost'}`}>
        {hours.map((_, i) => (
          <div key={i} className="flex-1 min-w-0 text-center">
            {i % 5 === 0 && (
              <span className="o-label" style={{ fontSize: 10.5, letterSpacing: '0.03em', textTransform: 'none' }}>
                {hourLabel(FROM + i)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhenYouStudy;
