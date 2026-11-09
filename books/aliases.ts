/* ── Reference books' chapter names, in NCERT's words ──
   Pure and tested (books/tests/mapping.test.ts). Halliday, Resnick & Walker,
   HC Verma and the like name their chapters their own way: "Kinetic Energy
   and Work" is NCERT's Work, Energy & Power, "Images" is Ray Optics, "Force
   and Motion" is Laws of Motion. Word overlap alone cannot see that, and it
   ties ("Motion in Two and Three Dimensions" is as close to Laws of Motion as
   to Motion in a Plane). These are checked first, in order, so the more
   specific rule wins ("electromagnetic waves" before "waves").

   Each target must be a chapter name exactly as constants.tsx spells it; a
   target the student's syllabus does not have is simply skipped. Add a rule
   only for a name a real book uses, and a test with it. */

import type { BookSubject } from './model';

type Rule = [RegExp, string];

const PHYSICS: Rule[] = [
  [/\bmeasurement|\bunits?\b.*\bdimension|\bphysical world/i, 'Units & Measurements'],
  [/\bstraight line|\bone dimension|\brectilinear/i, 'Motion in a Straight Line'],
  [/\b(two|three|2|3)\b.*dimension|\bprojectile|\bcircular motion|\bvectors?\b|\bmotion in a plane/i, 'Motion in a Plane'],
  [/\bforce and motion|\bnewton'?s laws|\blaws of motion|\bfriction\b/i, 'Laws of Motion'],
  [/\bwork\b.*\benergy|\benergy\b.*\bwork|\bpotential energy|\bconservation of energy/i, 'Work, Energy & Power'],
  [/\bcent(er|re) of mass|\blinear momentum|\brotation|\brolling|\btorque|\bangular momentum|\brigid bod/i, 'System of Particles & Rotational Motion'],
  [/\bgravitation/i, 'Gravitation'],
  [/\belasticity|\bmechanical properties of solids|\bstress\b.*\bstrain/i, 'Mechanical Properties of Solids'],
  [/\bfluids?\b|\bviscosity|\bsurface tension/i, 'Mechanical Properties of Fluids'],
  [/\belectromagnetic waves/i, 'Electromagnetic Waves'],
  [/\belectromagnetic oscillations|\balternating current|\bac circuits?/i, 'Alternating Current'],
  [/\binduction|\binductance/i, 'Electromagnetic Induction'],
  [/\bkinetic theory/i, 'Kinetic Theory'],
  [/\bthermodynamics|\bentropy|\bheat engines?/i, 'Thermodynamics'],
  [/\btemperature|\bheat\b|\bcalorimetry|\bthermal (properties|expansion)/i, 'Thermal Properties of Matter'],
  [/\boscillations?\b|\bsimple harmonic/i, 'Oscillations'],
  [/\bphotons?\b|\bmatter waves|\bphotoelectric|\bdual nature/i, 'Dual Nature of Radiation & Matter'],
  [/\binterference|\bdiffraction|\bpolari[sz]ation|\bwave optics/i, 'Wave Optics'],
  [/\bwaves?\b/i, 'Waves'],
  [/\bcoulomb|\belectric charges?\b|\belectric fields?\b|\bgauss/i, 'Electric Charges & Fields'],
  [/\belectric potential|\belectrostatic potential|\bcapacitance|\bcapacitors?\b/i, 'Electrostatic Potential & Capacitance'],
  [/\bcurrent and resistance|\bcurrent electricity|\bcircuits?\b/i, 'Current Electricity'],
  [/\bmagnetism of matter|\bmagnetism and matter|\bmaxwell/i, 'Magnetism & Matter'],
  [/\bmagnetic fields?\b|\bmoving charges/i, 'Moving Charges & Magnetism'],
  [/\bimages?\b|\brefraction|\bmirrors?\b|\blens(es)?\b|\bray optics|\boptical instruments/i, 'Ray Optics & Optical Instruments'],
  [/\bnuclear|\bnuclei|\bnucleus|\bradioactiv/i, 'Nuclei'],
  [/\bsemiconductors?|\bconduction of electricity in solids|\btransistors?|\bdiodes?\b/i, 'Semiconductor Electronics'],
  [/\batoms?\b|\bbohr/i, 'Atoms'],
];

const RULES: Partial<Record<BookSubject, Rule[]>> = { Physics: PHYSICS };

/** NCERT's name for a reference book's chapter title, when a rule knows it. */
export const aliasFor = (subject: BookSubject, title: string): string | null => {
  for (const [re, chapter] of RULES[subject] ?? []) if (re.test(title)) return chapter;
  return null;
};
