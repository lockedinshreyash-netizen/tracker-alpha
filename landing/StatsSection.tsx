import React from 'react';
import { ACCENT, INK, INK_FAINT, INK_MUTED, MICRO_LABEL, PAGE_X, RULE, TYPE } from './tokens';

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

    <div className="flex items-baseline gap-3" style={{ whiteSpace: 'nowrap' }}>
      <span
        className="font-display"
        style={{
          fontSize: TYPE.statHero,
          lineHeight: 0.82,
          letterSpacing: '-0.045em',
          color: INK,
        }}
      >
        Hundreds
      </span>
    </div>
    <p className="font-data" style={{ ...MICRO_LABEL, color: ACCENT, marginTop: '18px' }}>
      of students tracking
    </p>
    <p className="font-ui" style={{ fontSize: TYPE.body, color: INK_MUTED, marginTop: '10px', maxWidth: '30ch' }}>
      While you hesitate, they grind.
    </p>
  </section>
);

export default StatsSection;
