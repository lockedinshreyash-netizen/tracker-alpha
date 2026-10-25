/* ── Your exam, on your profile ──
   Keeps the exam columns of the student's own profile (profiles.sql, "Exams
   on the profile") in step with their exam settings, so other students see
   the right chip beside their name. Mounted at App root, like the profile
   controller, because the settings can change from any tab.

   Writes only when what should be on the profile differs from what was last
   written (or found there), a moment after the last change, so stepping
   through the exam sheet costs one write. With "Show my exam on my profile"
   off it writes nulls once and then nothing. Signed out, nothing. */

import { useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { updateProfileExam, type Profile, type ProfileExam } from './profileApi';
import { setCachedProfile } from './profileCache';
import type { ExamTarget } from '../content/exams';

const DEBOUNCE_MS = 1200;

const keyOf = (v: ProfileExam | null) => (v ? `${v.exam}|${v.exam_year}|${v.exams_also.join(',')}` : 'hidden');

export const useExamOnProfile = (user: User | null, own: Profile | null, target: ExamTarget, show: boolean): void => {
  const written = useRef<{ uid: string; key: string } | null>(null);
  const want: ProfileExam | null = show ? { exam: target.primary, exam_year: target.year, exams_also: target.also } : null;
  const wantKey = keyOf(want);

  useEffect(() => {
    if (!user || !own || own.user_id !== user.id) return;
    // What the profile already says counts as written: nothing to do if it matches.
    if (written.current?.uid !== user.id) {
      written.current = {
        uid: user.id,
        key: own.exam && own.exam_year ? keyOf({ exam: own.exam, exam_year: own.exam_year, exams_also: own.exams_also ?? [] }) : 'hidden',
      };
    }
    if (written.current.key === wantKey) return;
    const value = want;
    const t = window.setTimeout(() => {
      updateProfileExam(user.id, value)
        .then(() => {
          written.current = { uid: user.id, key: wantKey };
          setCachedProfile({ ...own, exam: value?.exam ?? null, exam_year: value?.exam_year ?? null });
        })
        .catch(() => { /* tried again on the next change or the next session */ });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
    // `want` is described entirely by `wantKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, own?.user_id, wantKey]);
};
