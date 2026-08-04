# Sound cues

Filenames here are **exact** — `audio.ts` looks each one up by path, so a
renamed file is a silent cue.

| File | Fires when | Length | Character |
|---|---|---|---|
| `ignite.mp3` | Onboarding spotlight turns on | ~1.5s | Whoosh into a soft impact |
| `riser.mp3` | Under the days-remaining count-up | ~1.2s | Rising tone that resolves as the number lands |
| `select.mp3` | Any tap/choice in onboarding or Pomodoro | ~150ms | Clean, dry tap — not a beep |
| `lock.mp3` | Final "Lock in" button at the end of onboarding | ~1s | Mechanical, low, satisfying |
| `phase-complete.mp3` | A Pomodoro focus block finishes | ~1–1.5s | Warm chime, earned rather than alarming |
| `break-over.mp3` | A Pomodoro break finishes | ~1s | Gentle nudge back to work |

Every cue fails silently: a missing file, a blocked autoplay, or a browser with
no audio support is a no-op, never an error. The app is meant to run fine with
this folder empty.

Per-cue volume is set in `CUE_CONFIG` in `/audio.ts`, so a file that lands too
loud or too quiet is a one-line change there rather than a re-export.
