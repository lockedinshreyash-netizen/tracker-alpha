/* ── A pasted question picture ──
   Read from this device (mocks/images.ts). On another device the entry has
   synced but the picture has not, and it says so instead of a broken image. */

import React, { useEffect, useState } from 'react';
import { errorImageUrl } from './images';

interface Props {
  id: string;
  dark: boolean;
  /** Tallest it may be drawn, in px. */
  maxHeight?: number;
  className?: string;
}

export const ErrorImage = ({ id, dark, maxHeight = 420, className = '' }: Props) => {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setUrl(undefined);
    errorImageUrl(id).then(u => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [id]);

  const frame = `rounded-lg border ${dark ? 'border-white/[0.08]' : 'border-zinc-200'}`;
  if (url === undefined) {
    return <div className={`${frame} ${dark ? 'bg-white/[0.03]' : 'bg-zinc-50'} ${className}`} style={{ height: Math.min(maxHeight, 120) }} aria-hidden />;
  }
  if (url === null) {
    return (
      <div className={`${frame} border-dashed px-3 py-3 text-[12px] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-500'} ${className}`}>
        Picture saved on another device.
      </div>
    );
  }
  return (
    // The picture is the question: always on white, so black print reads in dark mode too.
    <img
      src={url}
      alt="The question"
      draggable={false}
      className={`${frame} block bg-white max-w-full w-auto h-auto object-contain ${className}`}
      style={{ maxHeight }}
    />
  );
};

export default ErrorImage;
