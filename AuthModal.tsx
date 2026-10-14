import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import LiquidGlass from './ui/LiquidGlass';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
}

const GoogleMark = () => (
  <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/* Google is the only way in. Email and password sign-up and sign-in were
   removed: one tap with an account the student already has, no password to
   forget, and nothing for a minor to type into a form. An account first made
   with email and password reaches the same account by signing in with Google
   on that address (Supabase links a verified Google identity to an existing
   user with the same email). */
const AuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  theme,
}) => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // On success the browser navigates to Google — nothing after this runs.
    } catch (err: any) {
      setError(err.message || 'Could not reach Google. Try again.');
      setGoogleLoading(false);
    }
  };

  if (!isOpen) return null;

  const dark = theme === 'dark';
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500';

  return (
    /* Glass card over the live app (ui/LiquidGlass.tsx). The dimming is a
       SIBLING behind the card, never its parent, and never blurred: a
       backdrop-filter or opacity on an ancestor makes it a backdrop root, and
       the card would refract only that ancestor's black fill. */
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 mk-fade"
        style={{ background: dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(20, 20, 24, 0.26)' }}
        onClick={onClose}
      />
      <LiquidGlass
        dark={dark}
        radius={28}
        variant="panel"
        bezel={20}
        strength={24}
        className="lg-pop relative w-full max-w-sm max-h-full flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
      >
      {/* Scrolls inside the glass: on the glass itself the absolutely placed
          layers would scroll away with the content. */}
      <div className="p-7 space-y-5 min-h-0 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-ui">Sign In</h2>
          <button
            onClick={onClose}
            className={`text-xs font-black uppercase tracking-[0.06em] ${dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            Close
          </button>
        </div>

        <p className={`text-[13px] leading-relaxed font-ui ${muted}`}>
          Save your progress and sync it to every device. Show up in Ranks and Groups.
        </p>

        {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}

        <button
          type="button"
          disabled={googleLoading}
          onClick={handleGoogleSignIn}
          className={`w-full py-3.5 rounded-xl border flex items-center justify-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.12em] font-ui transition-all active:scale-[0.98] disabled:opacity-60 ${dark
            ? 'bg-white text-zinc-900 border-transparent hover:bg-zinc-100'
            : 'bg-white text-zinc-900 border-black/[0.08] hover:border-black/20'
            }`}
        >
          <GoogleMark />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <p className={`text-[11px] leading-relaxed font-ui ${muted}`}>
          Signed up with email before? Use Google with the same email address.
        </p>
      </div>
      </LiquidGlass>
    </div>
  );
};

export default AuthModal;
