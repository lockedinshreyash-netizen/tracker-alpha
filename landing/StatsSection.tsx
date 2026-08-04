import React from 'react';
import { ACCENT, INK, INK_FAINT, INK_MUTED, MICRO_LABEL, PAGE_X, RULE, TYPE } from './tokens';

const secondary = [
  { value: '5,000+', label: 'Hours logged' },
  { value: '336', label: 'Longest streak' },
  { value: '54+', label: 'Cities in India' },
];

const StatsSection = () => (
  <section
    style={{
      paddingLeft: PAGE_X,
      paddingRight: PAGE_X,
      paddingTop: 'clamp(88px, 14vh, 168px)',
      paddingBottom: 'clamp(88px, 14vh, 168px)',
      borderTop: `1px solid ${RULE}`,
    }}
  >
    <p className="font-data" style={{ ...MICRO_LABEL, color: INK_FAINT, marginBottom: 'clamp(24px, 4vh, 44px)' }}>
      [ The numbers ]
    </p>

    {/* Dominant stat carries the section; the rest are deliberately quiet */}
    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 items-end">
      <div className="md:col-span-6">
        <div className="flex items-baseline gap-3" style={{ whiteSpace: 'nowrap' }}>
          <span
            className="font-display"
            style={{
              fontSize: TYPE.statHero,
              lineHeight: 0.82,
              letterSpacing: '-0.045em',
              color: INK,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            1,500+
          </span>
        </div>
        <p className="font-data" style={{ ...MICRO_LABEL, color: ACCENT, marginTop: '18px' }}>
          Aspirants tracking
        </p>
        <p className="font-ui" style={{ fontSize: TYPE.body, color: INK_MUTED, marginTop: '10px', maxWidth: '30ch' }}>
          While you hesitate, they grind.
        </p>
      </div>

      <div className="md:col-span-6 grid grid-cols-3 gap-5 md:gap-8">
        {secondary.map(s => (
          <div key={s.label} style={{ borderTop: `1px solid ${RULE}`, paddingTop: '16px' }}>
            <p
              className="font-display"
              style={{
                fontSize: TYPE.statSm,
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
                color: INK,
                margin: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.value}
            </p>
            <p className="font-data" style={{ ...MICRO_LABEL, color: INK_FAINT, marginTop: '10px' }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default StatsSection;
