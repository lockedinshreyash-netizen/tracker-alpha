import React from 'react';
import { AnnouncementType } from './api';

/* ── How each kind of notice presents ──
   One table, so the modal, the line on Today and the console cannot disagree
   about what "maintenance" looks like.

   The accent is spent on `important` alone. #E10600 is the app's action colour
   — it is on the now-line, the end-session button and nothing decorative — and
   a broadcast that arrives in it every time teaches people to stop reading it.
   The other three wear the theme's own muted ink and are told apart by the
   word and the glyph. */

export interface TypeFace {
  label: string;
  /** True for the one kind allowed to wear the accent. */
  urgent: boolean;
  icon: React.ReactNode;
}

const stroke = {
  width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2.2,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};

export const TYPE_FACE: Record<AnnouncementType, TypeFace> = {
  announcement: {
    label: 'Announcement',
    urgent: false,
    icon: (
      <svg {...stroke}>
        <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z" />
        <path d="M16 8a5 5 0 0 1 0 8" />
      </svg>
    ),
  },
  update: {
    label: 'Update',
    urgent: false,
    icon: (
      <svg {...stroke}>
        <polyline points="21 4 21 10 15 10" />
        <path d="M20.5 14a8.5 8.5 0 1 1-2-8.6L21 8" />
      </svg>
    ),
  },
  important: {
    label: 'Important',
    urgent: true,
    icon: (
      <svg {...stroke}>
        <path d="M12 3 2.5 20h19L12 3z" />
        <line x1="12" y1="10" x2="12" y2="14" />
        <line x1="12" y1="17.4" x2="12" y2="17.5" />
      </svg>
    ),
  },
  maintenance: {
    label: 'Maintenance',
    urgent: false,
    icon: (
      <svg {...stroke}>
        <path d="M14.5 5.5a4 4 0 0 0 5 5L21 9V4h-5l-1.5 1.5z" />
        <path d="M14.2 10.8 4.8 20.2a2 2 0 0 1-2.8-2.8l9.4-9.4" />
      </svg>
    ),
  },
  poll: {
    label: 'Poll',
    urgent: false,
    icon: (
      <svg {...stroke}>
        <line x1="5" y1="20" x2="5" y2="12" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="19" y1="20" x2="19" y2="15" />
      </svg>
    ),
  },
  video: {
    label: 'New video',
    urgent: false,
    icon: (
      <svg {...stroke}>
        <rect x="2.5" y="5" width="19" height="14" rx="4" />
        <path d="M10.5 9.5 15 12l-4.5 2.5z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
};
