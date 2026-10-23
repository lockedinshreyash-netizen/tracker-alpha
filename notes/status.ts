/* Syllabus status as a colour, for the chapter dots in notes. Its own file
   because the page chrome needs it and the editor's node file would bring
   TipTap into the tab's first chunk with it. */

import type { SyllabusStatus } from '../types';

export const STATUS_HEX: Record<SyllabusStatus, string> = {
  not_started: '#71717a',
  in_progress: '#EAB308',
  practice_pending: '#FB923C',
  completed: '#22C55E',
  revision_pending: '#A78BFA',
};
