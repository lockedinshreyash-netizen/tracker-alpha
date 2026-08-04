import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { COMMAND_HELP, VoiceIntent, parseCommand } from './commands';
import { VoiceListener, isVoiceSupported } from './speech';

export interface VoiceFeedback {
  ok: boolean;
  message: string;
}

interface Props {
  theme: 'dark' | 'light';
  /** Runs the intent against app state and reports back what happened. */
  onCommand: (intent: VoiceIntent) => VoiceFeedback;
}

const MicIcon: React.FC<{ muted: boolean }> = ({ muted }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
    {muted && <line x1="3" y1="3" x2="21" y2="21" />}
  </svg>
);

const FEEDBACK_MS = 4000;

/**
 * Floating push-to-listen control. Renders nothing at all on browsers without
 * the Web Speech API (Firefox, most in-app webviews) — a dead mic button is
 * worse than no mic button.
 */
const VoiceControl: React.FC<Props> = ({ theme, onCommand }) => {
  const [supported] = useState(isVoiceSupported);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const listenerRef = useRef<VoiceListener | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  /* The listener is built once, so its callbacks must not close over a stale
     handler — app state changes on nearly every command. */
  const onCommandRef = useRef(onCommand);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);

  const flash = (next: VoiceFeedback) => {
    setFeedback(next);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
  };

  const handleTranscript = (text: string, isFinal: boolean) => {
    setInterim(isFinal ? '' : text.trim());
    if (!isFinal) return;

    const intent = parseCommand(text);
    if (!intent) {
      // Ambient conversation lands here constantly, so this stays quiet copy
      // rather than an error — it's the expected case, not a failure.
      flash({ ok: false, message: `NOT A COMMAND: “${text.trim().slice(0, 40)}”` });
      return;
    }

    if (intent.kind === 'help') {
      setShowHelp(true);
      return;
    }

    const result = onCommandRef.current(intent);
    if (result.ok) sfx.select();
    flash(result);
  };

  useEffect(() => {
    if (!supported) return;
    const listener = new VoiceListener({
      onTranscript: handleTranscript,
      onListeningChange: (active) => {
        setListening(active);
        if (!active) setInterim('');
      },
      onError: (message) => flash({ ok: false, message }),
    });
    listenerRef.current = listener;
    return () => {
      listener.stop();
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    };
  }, [supported]);

  if (!supported) return null;

  const dark = theme === 'dark';

  const toggle = () => {
    const listener = listenerRef.current;
    if (!listener) return;
    if (listener.isListening) {
      listener.stop();
      setInterim('');
      flash({ ok: true, message: 'MIC OFF.' });
    } else {
      // The permission prompt (first time) rides on this click gesture.
      listener.start();
      flash({ ok: true, message: 'LISTENING. SAY “HELP” FOR COMMANDS.' });
    }
  };

  const panel = dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-[#E3E0D9]';
  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2 pointer-events-none">
        {/* Live speech, then the outcome of the last command. */}
        {(interim || feedback) && (
          <div className={`max-w-[min(19rem,calc(100vw-2.5rem))] px-4 py-2.5 rounded-lg border shadow-lg pointer-events-auto ${panel}`}>
            {interim ? (
              <p className={`text-[11px] font-ui italic leading-snug ${muted}`}>{interim}</p>
            ) : (
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui leading-snug ${feedback!.ok ? 'text-[#E10600]' : muted}`}>
                {feedback!.message}
              </p>
            )}
          </div>
        )}

        {/* Stacked rather than sat beside the mic: on a phone this whole
            column floats over the timer, so it stays as narrow as possible. */}
        {listening && (
          <button
            onClick={() => setShowHelp(true)}
            className={`px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-[0.08em] font-ui transition-all active:scale-95 pointer-events-auto ${panel} ${muted}`}
          >
            Commands
          </button>
        )}

        <button
          onClick={toggle}
          aria-pressed={listening}
          aria-label={listening ? 'Stop voice commands' : 'Start voice commands'}
          className={`relative w-14 h-14 rounded-full border flex items-center justify-center transition-all active:scale-95 shadow-lg pointer-events-auto ${listening
            ? 'bg-[#E10600] border-[#E10600] text-white'
            : `${panel} ${dark ? 'text-zinc-400 hover:text-white' : 'text-[#6B675C] hover:text-[#17150F]'}`
            }`}
        >
          {listening && <span className="absolute inset-0 rounded-full bg-[#E10600] animate-ping opacity-30" />}
          <span className="relative"><MicIcon muted={!listening} /></span>
        </button>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-xl border p-6 md:p-8 animate-slide-up ${panel}`}
          >
            <p className={`text-xs font-black uppercase tracking-[0.1em] font-ui ${dark ? 'text-white' : 'text-[#17150F]'}`}>
              Say it, don't click it
            </p>
            <p className={`text-[10px] font-ui mt-1 ${muted}`}>
              Speak the whole phrase. Half a phrase does nothing.
            </p>

            <div className="mt-6 space-y-5">
              {COMMAND_HELP.map(({ group, examples }) => (
                <div key={group}>
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#E10600] font-ui">{group}</p>
                  <ul className="mt-2 space-y-1.5">
                    {examples.map(example => (
                      <li key={example} className={`text-[11px] font-ui ${dark ? 'text-zinc-300' : 'text-[#3A362C]'}`}>
                        “{example}”
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className={`text-[9px] font-ui leading-relaxed mt-6 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'} ${muted}`}>
              The mic stays on until you switch it off, including when this tab is in
              the background. Your browser does the transcribing — on Chrome and Edge
              that means audio goes to their speech service, not to this app.
            </p>

            <button
              onClick={() => setShowHelp(false)}
              className={`w-full mt-6 py-3.5 rounded-lg font-black uppercase tracking-[0.2em] text-[10px] font-ui transition-all active:scale-[0.98] ${dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}
            >
              Back to work
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceControl;
