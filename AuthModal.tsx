import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import LiquidGlass from './ui/LiquidGlass';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onAuthSuccess: () => void;
}

const GoogleMark = () => (
  <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const AuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  theme,
  onAuthSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
  const field = `w-full rounded-xl px-3.5 py-3 text-[13px] font-medium font-ui border outline-none transition-colors ${dark
    ? 'bg-white/[0.06] border-white/[0.10] text-white placeholder:text-zinc-500 focus:border-white/30'
    : 'bg-white/60 border-black/[0.08] text-zinc-900 placeholder:text-zinc-400 focus:border-black/25'
    }`;

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
        aria-label={mode === 'login' ? 'Sign in' : 'Create account'}
      >
      {/* Scrolls inside the glass: on the glass itself the absolutely placed
          layers would scroll away with the form. */}
      <div className="p-7 space-y-4 min-h-0 overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-ui">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className={`text-xs font-black uppercase tracking-[0.06em] ${dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            Close
          </button>
        </div>

        {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}
        {successMsg && <p className="text-[11px] font-bold text-green-500">{successMsg}</p>}

        {/* Google */}
        <button
          type="button"
          disabled={googleLoading || loading}
          onClick={handleGoogleSignIn}
          className={`w-full py-3.5 rounded-xl border flex items-center justify-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.12em] font-ui transition-all active:scale-[0.98] disabled:opacity-60 ${dark
            ? 'bg-white text-zinc-900 border-transparent hover:bg-zinc-100'
            : 'bg-white text-zinc-900 border-black/[0.08] hover:border-black/20'
            }`}
        >
          <GoogleMark />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className={`flex-1 h-px ${dark ? 'bg-white/[0.10]' : 'bg-black/[0.08]'}`} />
          <span className={`text-[9px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>or</span>
          <div className={`flex-1 h-px ${dark ? 'bg-white/[0.10]' : 'bg-black/[0.08]'}`} />
        </div>

        <div className="space-y-3">
          <input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={field}
          />
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={field}
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            disabled={loading || googleLoading}
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                if (mode === 'login') {
                  const { error } = await supabase.auth.signInWithPassword({ email, password });
                  if (error) throw error;
                  onAuthSuccess();
                  onClose();
                } else {
                  const { error } = await supabase.auth.signUp({ email, password });
                  if (error) throw error;
                  setSuccessMsg('Check your email to confirm your account.');
                  onAuthSuccess();
                  // Keep the modal open so the confirmation message above is actually seen —
                  // the user dismisses it manually via Close.
                }
              } catch (err: any) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }}
            className="w-full py-3.5 rounded-xl bg-[#E10600] text-white text-[10px] font-bold uppercase tracking-[0.15em] font-ui hover:bg-red-700 active:scale-[0.98] transition-transform shadow-[0_8px_24px_-10px_rgba(225,6,0,0.7)] disabled:opacity-60"
          >
            {loading ? 'Processing…' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className={`text-[10px] font-medium uppercase tracking-[0.06em] ${dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already enrolled? Sign in'}
          </button>
        </div>
      </div>
      </LiquidGlass>
    </div>
  );
};

export default AuthModal;
