import React, { useState } from 'react';
import { ExamPreference } from './types';
import { supabase } from './supabaseClient';
import { PENDING_EXAM_PREF_KEY } from './state';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onAuthSuccess: (examPref?: ExamPreference) => void;
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
  const [examPref, setExamPref] = useState<ExamPreference>('JEE');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      // Parked for after the redirect; only applied to brand-new accounts.
      localStorage.setItem(PENDING_EXAM_PREF_KEY, examPref);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // On success the browser navigates to Google — nothing after this runs.
    } catch (err: any) {
      localStorage.removeItem(PENDING_EXAM_PREF_KEY);
      setError(err.message || 'Could not reach Google. Try again.');
      setGoogleLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 py-6">
      <div
        className={`w-full max-w-sm rounded-xl border p-6 space-y-4 max-h-full overflow-y-auto ${theme === 'dark' ? 'bg-[#0B0B0D] border-[#27272a]' : 'bg-white border-[#E3E0D9]'
          }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-ui">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className={`text-xs font-black uppercase tracking-[0.06em] ${theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-[#8A8577] hover:text-[#17150F]'}`}
          >
            Close
          </button>
        </div>

        {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}
        {successMsg && <p className="text-[11px] font-bold text-green-500">{successMsg}</p>}

        {/* Exam target — shown in both modes because a Google sign-in can create
            a new account from either one, and a NEET student must not silently
            land on the JEE subject set. Ignored for accounts that already exist. */}
        <div>
          <div className={`w-full rounded-md px-3 py-2 border flex justify-between items-center ${theme === 'dark' ? 'bg-[#18181b] border-[#27272a]' : 'bg-[#F2F0EC] border-[#E3E0D9]'}`}>
            <span className={`text-[10px] font-black uppercase tracking-wide ${theme === 'dark' ? 'text-zinc-500' : 'text-[#8A8577]'}`}>Exam Target</span>
            <div className="flex gap-2">
              {(['JEE', 'NEET'] as const).map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setExamPref(e)}
                  className={`px-3 py-1 text-[10px] font-bold rounded ${examPref === e ? 'bg-[#E10600] text-white' : (theme === 'dark' ? 'bg-[#27272a] text-zinc-400' : 'bg-[#E3E0D9] text-[#6B675C]')}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <p className={`text-[9px] font-medium mt-1.5 px-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}>
            Only used when creating a new account. Switchable later.
          </p>
        </div>

        {/* Google */}
        <button
          type="button"
          disabled={googleLoading || loading}
          onClick={handleGoogleSignIn}
          className={`w-full py-3 rounded-md border flex items-center justify-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.12em] font-ui transition-all disabled:opacity-60 ${theme === 'dark'
            ? 'bg-white text-[#17150F] border-transparent hover:bg-zinc-100'
            : 'bg-white text-[#17150F] border-[#E3E0D9] hover:border-[#D6D1C5]'
            }`}
        >
          <GoogleMark />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-[#27272a]' : 'bg-[#E3E0D9]'}`} />
          <span className={`text-[9px] font-bold uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}>or</span>
          <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-[#27272a]' : 'bg-[#E3E0D9]'}`} />
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={`w-full rounded-md px-3 py-2 text-xs font-bold uppercase tracking-tight border ${theme === 'dark'
              ? 'bg-[#18181b] border-[#27272a] text-white'
              : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F]'
              }`}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={`w-full rounded-md px-3 py-2 text-xs font-bold uppercase tracking-tight border ${theme === 'dark'
              ? 'bg-[#18181b] border-[#27272a] text-white'
              : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F]'
              }`}
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
                  const { error } = await supabase.auth.signUp({ email, password, options: { data: { examPreference: examPref } } });
                  if (error) throw error;
                  setSuccessMsg('Check your email to confirm your account.');
                  onAuthSuccess(examPref);
                  // Keep the modal open so the confirmation message above is actually seen —
                  // the user dismisses it manually via Close.
                }
              } catch (err: any) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }}
            className="w-full py-3 rounded-md bg-[#E10600] text-white text-[10px] font-bold uppercase tracking-[0.15em] font-ui hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? 'Processing…' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className={`text-[10px] font-medium uppercase tracking-[0.06em] ${theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-[#8A8577] hover:text-[#17150F]'}`}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already enrolled? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
