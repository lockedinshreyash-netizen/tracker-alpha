/* ── The membership card ──
   The object Alpha is now sold as. Black, brushed, one red hairline, the
   member number set like a card number. Drawn in CSS (access.css) so the Gate,
   the member card and the welcome moment are the same card. */

import './access.css';

export const memberNo = (n: number | null | undefined): string =>
  typeof n === 'number' && n > 0 ? String(n).padStart(4, '0') : '····';

interface Props {
  no: number | null | undefined;
  name: string | null | undefined;
  tier: string;
  flat?: boolean;
}

const CardArt = ({ no, name, tier, flat = false }: Props) => (
  <div className={`ax-card${flat ? ' flat' : ''}`} role="img" aria-label={`Tracker Alpha membership card, number ${memberNo(no)}, ${tier}`}>
    <div className="ax-card-top">
      <span className="ax-card-mark">ALPHA</span>
      <span className="ax-card-alpha" aria-hidden="true">α</span>
    </div>
    <div className="ax-card-mid">
      <div className="ax-card-no">No. {memberNo(no)}</div>
    </div>
    <div className="ax-card-bot">
      <div style={{ minWidth: 0 }}>
        <div className="ax-card-name">{name?.trim() || 'Your name here'}</div>
        <div className="ax-card-tier">{tier}</div>
      </div>
    </div>
    <span className="ax-card-line" aria-hidden="true" />
  </div>
);

export default CardArt;

/** What the card says under the name. */
export const tierOf = (source: string | null | undefined): string =>
  source === 'founding' ? 'Founding member' : source === 'pass' ? 'Priority Pass' : 'Member';
