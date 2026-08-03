import React, { useState } from 'react';
import { ExamPreference } from './types';
import { supabase } from './supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onAuthSuccess: (examPref?: ExamPreference) => void;
}

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
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div
        className={`w-full max-w-sm rounded-xl border p-6 space-y-4 ${theme === 'dark' ? 'bg-[#0B0B0D] border-[#27272a]' : 'bg-white border-[#E3E0D9]'
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
          {mode === 'signup' && (
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
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            disabled={loading}
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
