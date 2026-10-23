/* ── Notes is opt-in ──
   Whether the student turned Notes on rides AppState, so turning it on once
   reaches every device on the account. It is a dated decision, not a flag:
   App's local-newer merge spreads the remote blob over the local one, and a
   bare boolean would let an older "off" from another device undo a newer
   "on" here. Every merge path keeps whichever decision was made last.

   Kept import-free: App imports it in the main bundle. */

export interface NotesPref { on: boolean; at: number }

export const notesOn = (p: NotesPref | undefined | null): boolean => !!p?.on;

export const mergeNotesPref = (a: NotesPref | undefined, b: NotesPref | undefined): NotesPref | undefined => {
  if (!a) return b;
  if (!b) return a;
  return b.at > a.at ? b : a;
};
