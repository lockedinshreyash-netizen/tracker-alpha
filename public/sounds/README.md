# Sound effects

Generated, not sourced. Every file here is rendered by
`film/scripts/render-sfx.ts` from the instruments in
`film/scripts/audio/sfx-instruments.ts`:

```
npm run sfx:generate                      # every cue
cd film && npm run sfx -- --only=streak   # just the ids containing "streak"
```

Do not edit or replace the files by hand: the next render overwrites them.

- **The ids come from `sound/cues.ts`.** That catalog is the single list. The
  renderer refuses to run if a cue there has no recipe, and the player
  (`audio.ts`) fetches `/sounds/<id>.aac` for each one.
- **The format is ADTS AAC** (`.aac`): mono at 48 kbps for short cues, stereo
  at 80 kbps for celebrations. It is not `.m4a`, because afconvert pads every
  MP4 with about 3 kB of empty space.
- **Levels live in the catalog's `gain`, not in these files.** Every master
  is normalised to the same −1 dBFS peak. To make a cue louder or quieter,
  change one number in `sound/cues.ts`, then judge it at `?sfx=debug`.
- **Listen to all of them in Remotion Studio.** Run `cd film && npm run dev`
  and open the `SoundBoard` composition.

Every cue fails silently. A missing file, a blocked context, or a browser
with no Web Audio is a no-op, never an error.
