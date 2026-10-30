/* The founding-member moment is shown once per account on each device.
   Kept apart from MemberSheet so App can ask without loading the sheet. */

const KEY = 'alpha_member_intro_v1';

export const memberIntroDue = (uid: string): boolean => {
  try { return localStorage.getItem(`${KEY}:${uid}`) !== '1'; } catch { return false; }
};

export const markMemberIntro = (uid: string): void => {
  try { localStorage.setItem(`${KEY}:${uid}`, '1'); } catch { /* shown again next visit, harmless */ }
};
