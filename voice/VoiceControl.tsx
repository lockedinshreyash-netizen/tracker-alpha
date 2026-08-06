import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { COMMAND_HELP, VoiceIntent, asTaskBody, joinSegments, parseBestOf, parseCommand } from './commands';
import {
  VoiceListener,
  canResumeWithoutPrompt,
  getVoicePreference,
  isVoiceSupported,
  setVoicePreference,
} from './speech';
import {
  cancelSpeech,
  getPreferredVoiceName,
  getSpeakPreference,
  isSpeechOutSupported,
  listVoices,
  prefetchCommonClips,
  setPreferredVoiceName,
  setSpeakPreference,
  speak,
} from './speechOut';

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
/** Answers to questions are read, not glanced at. */
const ANSWER_MS = 7000;

/* Recognition often splits one spoken sentence into several final segments
   ("add task revise" then "thermodynamics"). Executing each as it lands both
   truncates the command and fires it more than once, so segments are collected
   and run as a single utterance once the speaker pauses. */
const COALESCE_MS = 700;

/** How long a bare "add task" waits for the user to say what the task is. */
const TASK_BODY_TIMEOUT_MS = 20000;

/**
 * Floating voice control. Renders nothing at all on browsers without the Web
 * Speech API (Firefox, most in-app webviews) — a dead mic button is worse than
 * no mic button.
 */
const VoiceControl: React.FC<Props> = ({ theme, onCommand }) => {
  const [supported] = useState(isVoiceSupported);
  const [listening, setListening] = useState(false);
  /* What the user asked for. Stays true while the mic is briefly closed so the
     app can speak, which `listening` does not. */
  const [micOn, setMicOn] = useState(false);
  const [interim, setInterim] = useState('');
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [awaitingTask, setAwaitingTask] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechOn, setSpeechOn] = useState(() => isSpeechOutSupported() && getSpeakPreference());
  const speechOnRef = useRef(speechOn);
  useEffect(() => { speechOnRef.current = speechOn; }, [speechOn]);

  /* Only used for the handful of replies with no pre-rendered clip. */
  const [systemVoices, setSystemVoices] = useState<{ name: string; lang: string }[]>([]);
  const [systemVoice, setSystemVoice] = useState(getPreferredVoiceName);

  const listenerRef = useRef<VoiceListener | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  /* The listener is built once, so its callbacks must not close over a stale
     handler — app state changes on nearly every command. */
  const onCommandRef = useRef(onCommand);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);

  const segments = useRef<{ text: string; alternatives: string[] }[]>([]);
  const flushTimer = useRef<number | null>(null);
  const awaitingTaskRef = useRef(false);
  const taskPromptTimer = useRef<number | null>(null);

  const flash = (next: VoiceFeedback, ms: number = FEEDBACK_MS) => {
    setFeedback(next);
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), ms);
  };

  const cancelTaskPrompt = () => {
    awaitingTaskRef.current = false;
    setAwaitingTask(false);
    if (taskPromptTimer.current !== null) {
      window.clearTimeout(taskPromptTimer.current);
      taskPromptTimer.current = null;
    }
  };

  /**
   * Say a line out loud, with the microphone closed for the duration.
   *
   * Without the pause, recognition transcribes the app's own voice and feeds it
   * straight back in as the next "command" — at best noise, at worst a loop.
   */
  const say = (message: string) => {
    if (!speechOnRef.current) return;
    const listener = listenerRef.current;
    speak(message, {
      onStart: () => {
        setSpeaking(true);
        listener?.suspend();
      },
      onDone: () => {
        setSpeaking(false);
        listener?.resume();
      },
    });
  };

  const run = (intent: VoiceIntent) => {
    const result = onCommandRef.current(intent);
    if (result.ok) sfx.select();
    flash(result, intent.kind === 'query' ? ANSWER_MS : FEEDBACK_MS);
    say(result.message);
  };

  /** Runs one complete utterance, once the speaker has paused. */
  const execute = () => {
    const collected = segments.current;
    segments.current = [];
    if (!collected.length) return;

    // Splices overlapping fragments rather than concatenating them — see
    // joinSegments for why Android makes that necessary.
    const joined = joinSegments(collected.map(s => s.text));
    if (!joined) return;

    /* Alternatives only line up with a single-segment utterance; once segments
       are joined, the primary transcript is the only coherent candidate. */
    const candidates = collected.length === 1 && collected[0].alternatives.length
      ? collected[0].alternatives
      : [joined];

    // A bare "add task" put us in capture mode: this utterance is the body.
    if (awaitingTaskRef.current) {
      cancelTaskPrompt();
      const body = asTaskBody(joined);
      if (!body || /^(?:cancel|never mind|nevermind|forget it|stop)$/.test(body)) {
        flash({ ok: false, message: 'TASK CANCELLED.' });
        return;
      }
      // Reuse the grammar so the body gets the same subject tagging.
      const intent = parseCommand(`add task ${body}`);
      if (intent) run(intent);
      return;
    }

    const hit = parseBestOf(candidates);
    if (!hit) {
      // Ambient conversation lands here constantly, so this stays quiet copy
      // rather than an error — it's the expected case, not a failure.
      flash({ ok: false, message: `NOT A COMMAND: “${joined.slice(0, 40)}”` });
      return;
    }

    if (hit.intent.kind === 'help') {
      setShowHelp(true);
      return;
    }

    if (hit.intent.kind === 'stopListening') {
      cancelSpeech();
      listenerRef.current?.stop();
      setVoicePreference(false);
      flash({ ok: true, message: 'MIC OFF.' });
      return;
    }

    if (hit.intent.kind === 'setSpeech') {
      const on = hit.intent.on;
      setSpeechOn(on);
      speechOnRef.current = on;
      setSpeakPreference(on);
      if (!on) cancelSpeech();
      flash({ ok: true, message: on ? 'SPEAKING REPLIES.' : 'REPLIES MUTED.' });
      if (on) say('speaking replies');
      return;
    }

    if (hit.intent.kind === 'askTaskBody') {
      awaitingTaskRef.current = true;
      setAwaitingTask(true);
      flash({ ok: true, message: "WHAT'S THE TASK?" }, TASK_BODY_TIMEOUT_MS);
      taskPromptTimer.current = window.setTimeout(cancelTaskPrompt, TASK_BODY_TIMEOUT_MS);
      say("what's the task?");
      return;
    }

    run(hit.intent);
  };

  const handleTranscript = (text: string, isFinal: boolean, alternatives?: string[]) => {
    if (!isFinal) {
      setInterim(text.trim());
      return;
    }
    setInterim('');
    segments.current.push({ text: text.trim(), alternatives: alternatives ?? [text.trim()] });
    if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(() => {
      flushTimer.current = null;
      execute();
    }, COALESCE_MS);
  };

  useEffect(() => {
    if (!supported) return;

    const listener: VoiceListener = new VoiceListener({
      onTranscript: handleTranscript,
      onListeningChange: (active) => {
        setListening(active);
        if (!active) setInterim('');
        /* The engine stops during a spoken reply, but the user hasn't turned
           anything off — track intent separately so the button doesn't blink
           to "off" every time the app answers. */
        setMicOn(listener.isListening);
      },
      onError: (message) => flash({ ok: false, message }),
    });
    listenerRef.current = listener;

    /* Opted in previously → pick up where they left off. Gated on the mic
       already being granted, so opening the app never raises a prompt. */
    let cancelled = false;
    if (getVoicePreference()) {
      canResumeWithoutPrompt().then(ok => {
        if (ok && !cancelled) listener.start();
      });
    }

    return () => {
      cancelled = true;
      cancelSpeech();
      listener.stop();
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      if (taskPromptTimer.current !== null) window.clearTimeout(taskPromptTimer.current);
    };
  }, [supported]);

  /* The browser populates its voice list asynchronously, so the first lookup is
     usually empty. Re-read when it lands and adopt the ranked best as the shown
     selection when the user hasn't chosen one. */
  useEffect(() => {
    if (!isSpeechOutSupported()) return;
    const sync = () => {
      const ranked = listVoices().map(v => ({ name: v.name, lang: v.lang }));
      setSystemVoices(ranked);
      setSystemVoice(prev => prev || ranked[0]?.name || '');
    };
    sync();
    window.speechSynthesis.addEventListener?.('voiceschanged', sync);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', sync);
  }, []);

  /* Pull the replies this session is almost certain to use into the HTTP cache,
     so even the first one plays without a network round trip. */
  useEffect(() => {
    if (micOn && speechOn) prefetchCommonClips();
  }, [micOn, speechOn]);

  if (!supported) return null;

  const dark = theme === 'dark';

  const toggle = () => {
    const listener = listenerRef.current;
    if (!listener) return;
    if (listener.isListening) {
      cancelSpeech();
      listener.stop();
      cancelTaskPrompt();
      segments.current = [];
      setInterim('');
      setMicOn(false);
      setVoicePreference(false);
      flash({ ok: true, message: 'MIC OFF.' });
    } else {
      // The permission prompt (first time) rides on this click gesture.
      listener.start();
      setMicOn(true);
      setVoicePreference(true);
      flash({ ok: true, message: 'LISTENING. SAY “HELP” FOR COMMANDS.' });
    }
  };

  const toggleSpeech = () => {
    const next = !speechOn;
    setSpeechOn(next);
    speechOnRef.current = next;
    setSpeakPreference(next);
    if (!next) cancelSpeech();
  };

  /** Play a sample so the voice can be judged before it's used for real. */
  const preview = (line = 'SESSION LIVE: PHYSICS.') => {
    const listener = listenerRef.current;
    speak(line, {
      onStart: () => { setSpeaking(true); listener?.suspend(); },
      onDone: () => { setSpeaking(false); listener?.resume(); },
    });
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
        {micOn && (
          <button
            onClick={() => setShowHelp(true)}
            className={`px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-[0.08em] font-ui transition-all active:scale-95 pointer-events-auto ${panel} ${muted}`}
          >
            {speaking ? 'Speaking…' : 'Commands'}
          </button>
        )}

        <button
          onClick={toggle}
          aria-pressed={micOn}
          aria-label={micOn ? 'Stop voice commands' : 'Start voice commands'}
          className={`relative w-14 h-14 rounded-full border flex items-center justify-center transition-all active:scale-95 shadow-lg pointer-events-auto ${micOn
            ? 'bg-[#E10600] border-[#E10600] text-white'
            : `${panel} ${dark ? 'text-zinc-400 hover:text-white' : 'text-[#6B675C] hover:text-[#17150F]'}`
            }`}
        >
          {micOn && (
            <span className={`absolute inset-0 rounded-full bg-[#E10600] ${speaking || awaitingTask ? 'animate-pulse opacity-50' : listening ? 'animate-ping opacity-30' : ''}`} />
          )}
          <span className="relative"><MicIcon muted={!micOn} /></span>
        </button>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border p-6 md:p-8 animate-slide-up ${panel}`}
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

            {isSpeechOutSupported() && (
              <div className={`mt-6 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={speechOn}
                    onChange={toggleSpeech}
                    className="accent-[#E10600] w-4 h-4 flex-shrink-0"
                  />
                  <span className={`text-[10px] uppercase font-bold tracking-[0.06em] font-ui ${muted}`}>
                    Say the answer out loud
                  </span>
                </label>

                {speechOn && (
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => preview('SESSION LIVE: PHYSICS.')}
                      className={`w-full px-4 py-2 rounded-lg border text-[9px] font-bold uppercase tracking-[0.08em] font-ui transition-all active:scale-95 ${dark ? 'border-white/[0.06] text-zinc-300' : 'border-[#E3E0D9] text-[#3A362C]'}`}
                    >
                      Hear it
                    </button>

                    {/* Only reached for free-form text — task names and the like. */}
                    <details>
                      <summary className={`text-[9px] uppercase font-bold tracking-[0.06em] font-ui cursor-pointer ${muted}`}>
                        Fallback voice
                      </summary>
                      <select
                        value={systemVoice}
                        onChange={(e) => { setSystemVoice(e.target.value); setPreferredVoiceName(e.target.value); }}
                        className={`w-full mt-2 px-3 py-2 rounded-lg border text-[10px] font-ui ${dark ? 'bg-[#0D0D10] border-white/[0.06] text-zinc-300' : 'bg-white border-[#E3E0D9] text-[#3A362C]'}`}
                      >
                        {systemVoices.map(v => <option key={v.name} value={v.name}>{v.name} — {v.lang}</option>)}
                      </select>
                      <p className={`text-[9px] font-ui mt-2 ${muted}`}>
                        Used only for things with no recorded reply, like task names.
                      </p>
                    </details>
                  </div>
                )}
              </div>
            )}

            <p className={`text-[9px] font-ui leading-relaxed mt-5 ${muted}`}>
              The mic stays on while this tab is open, and switches itself back on
              next time you come back. It closes for a moment whenever the app
              speaks, so it can't hear itself. Your browser does the transcribing
              and the talking — on Chrome and Edge the audio goes to their speech
              service, not to this app. Say “stop listening” to switch the mic
              off, or “be quiet” to keep it listening silently.
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
