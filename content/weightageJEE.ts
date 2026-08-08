/**
 * JEE Main chapter weightage — consensus of published PYQ analyses.
 *
 * Methodology, source clusters and known limits: content/SOURCES.md.
 * Read that before changing a number here or before surfacing `percent` as a
 * fact in the UI.
 *
 * Two things to keep in mind when consuming this:
 *  1. Rankings are trustworthy; absolute percentages are not. Show tiers.
 *  2. `foundational` overrides `tier` for any "you can deprioritise this"
 *     affordance. See the field docs in ./types.ts.
 */

import { ChapterWeight, SourceCluster } from './types';

export const WEIGHTAGE_SOURCE_CLUSTERS: SourceCluster[] = [
  {
    id: 'cluster-a',
    sites: ['pw.live', 'vedantu.com', 'selfstudys.com', 'vvtcoaching.com'],
    basis: 'Stated as "past 5 years" of JEE Main papers. No site names the sessions, the paper count, or whether percentages are of questions or of marks.',
    granularity: 'chapter',
    // Chemistry's rows sum to 99.98%. Physics reaches 94.6% and Maths 92.7%,
    // so both are missing roughly a paper's worth of chapters.
    sumsTo100: { Chemistry: true, Physics: false, Maths: false },
  },
  {
    id: 'cluster-b',
    sites: ['supertutor.in', 'cracku.in', 'testbook.com'],
    basis: 'supertutor states Jan 2020 – Apr 2025, 10+ sessions; cracku states 2022–2024 averages; testbook does not state a basis.',
    granularity: 'unit',
    sumsTo100: {},
  },
];

/** When this content was compiled, so a stale-data check is possible later. */
export const WEIGHTAGE_COMPILED_ON = '2026-08-08';

export const JEE_WEIGHTAGE: ChapterWeight[] = [
  // ---------------------------------------------------------------- Physics 11
  { chapter: 'Units & Measurements', classId: 11, subject: 'Physics', percent: 4.24, tier: 'critical', confidence: 'high', foundational: true,
    note: 'Consistently high for how easy it is — errors/dimensions questions are near-guaranteed marks.' },
  { chapter: 'Motion in a Straight Line', classId: 11, subject: 'Physics', percent: 2.63, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Motion in a Plane', classId: 11, subject: 'Physics', percent: 2.92, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Laws of Motion', classId: 11, subject: 'Physics', percent: 2.05, tier: 'medium', confidence: 'high', foundational: true,
    note: 'Low direct count, but its concepts are embedded in most mechanics questions. Never present as skippable.' },
  { chapter: 'Work, Energy & Power', classId: 11, subject: 'Physics', percent: 2.37, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'System of Particles & Rotational Motion', classId: 11, subject: 'Physics', percent: 6.87, tier: 'critical', confidence: 'medium', foundational: false,
    mergedFrom: ['Centre of Mass & System of Particles (2.56)', 'Rotational Motion (4.31)'],
    note: 'Our chapter covers two source chapters; the figure is their sum.' },
  { chapter: 'Gravitation', classId: 11, subject: 'Physics', percent: 4.49, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Mechanical Properties of Solids', classId: 11, subject: 'Physics', percent: 2.08, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Mechanical Properties of Fluids', classId: 11, subject: 'Physics', percent: 3.00, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Thermal Properties of Matter', classId: 11, subject: 'Physics', percent: 2.08, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Thermodynamics', classId: 11, subject: 'Physics', percent: 3.06, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Kinetic Theory', classId: 11, subject: 'Physics', percent: 2.88, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Oscillations', classId: 11, subject: 'Physics', percent: 3.25, tier: 'high', confidence: 'high', foundational: true },
  { chapter: 'Waves', classId: 11, subject: 'Physics', percent: 1.94, tier: 'low', confidence: 'high', foundational: false },

  // ---------------------------------------------------------------- Physics 12
  { chapter: 'Electric Charges & Fields', classId: 12, subject: 'Physics', percent: 3.18, tier: 'high', confidence: 'high', foundational: true },
  { chapter: 'Electrostatic Potential & Capacitance', classId: 12, subject: 'Physics', percent: 4.49, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Current Electricity', classId: 12, subject: 'Physics', percent: 6.57, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Highest single Physics chapter in every source examined.' },
  { chapter: 'Moving Charges & Magnetism', classId: 12, subject: 'Physics', percent: 2.89, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Magnetism & Matter', classId: 12, subject: 'Physics', percent: 1.90, tier: 'low', confidence: 'high', foundational: false },
  { chapter: 'Electromagnetic Induction', classId: 12, subject: 'Physics', percent: 3.25, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Alternating Current', classId: 12, subject: 'Physics', percent: 3.73, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Electromagnetic Waves', classId: 12, subject: 'Physics', percent: 2.96, tier: 'medium', confidence: 'high', foundational: false,
    note: 'Small, almost entirely memory-based — very high marks per hour.' },
  { chapter: 'Ray Optics & Optical Instruments', classId: 12, subject: 'Physics', percent: 5.04, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Wave Optics', classId: 12, subject: 'Physics', percent: 2.30, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Dual Nature of Radiation & Matter', classId: 12, subject: 'Physics', percent: 4.05, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Atoms', classId: 12, subject: 'Physics', percent: 2.48, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Nuclei', classId: 12, subject: 'Physics', percent: 3.14, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Semiconductor Electronics', classId: 12, subject: 'Physics', percent: 4.75, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Frequently under-prepared relative to its weight.' },

  // -------------------------------------------------------------- Chemistry 11
  { chapter: 'Some Basic Concepts of Chemistry', classId: 11, subject: 'Chemistry', percent: 2.82, tier: 'medium', confidence: 'high', foundational: true,
    note: 'Mole concept underpins all of physical chemistry.' },
  { chapter: 'Structure of Atom', classId: 11, subject: 'Chemistry', percent: 3.34, tier: 'high', confidence: 'high', foundational: true },
  { chapter: 'Classification of Elements & Periodicity', classId: 11, subject: 'Chemistry', percent: 1.93, tier: 'low', confidence: 'high', foundational: true,
    note: 'Low direct weight; periodic trends are assumed knowledge across all of inorganic.' },
  { chapter: 'Chemical Bonding & Molecular Structure', classId: 11, subject: 'Chemistry', percent: 3.34, tier: 'high', confidence: 'high', foundational: true },
  { chapter: 'Thermodynamics', classId: 11, subject: 'Chemistry', percent: 3.65, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Equilibrium', classId: 11, subject: 'Chemistry', percent: 4.44, tier: 'critical', confidence: 'high', foundational: true,
    note: 'Ionic equilibrium feeds electrochemistry and salt analysis.' },
  { chapter: 'Redox Reactions', classId: 11, subject: 'Chemistry', percent: 1.75, tier: 'low', confidence: 'high', foundational: true,
    note: 'Prerequisite for electrochemistry and much of inorganic.' },
  { chapter: 'Organic Chemistry: Basic Principles & Techniques', classId: 11, subject: 'Chemistry', percent: 1.57, tier: 'low', confidence: 'medium', foundational: true,
    mergedFrom: ['General Organic Chemistry (1.20)', 'Isomerism (0.27)', 'IUPAC Nomenclature (0.10)'],
    note: 'The clearest case where weightage lies. ~1.6% directly, yet every organic question in the paper depends on it. Must never be shown as low priority.' },
  { chapter: 'Hydrocarbons', classId: 11, subject: 'Chemistry', percent: 3.03, tier: 'high', confidence: 'high', foundational: true },

  // -------------------------------------------------------------- Chemistry 12
  { chapter: 'Solutions', classId: 12, subject: 'Chemistry', percent: 4.54, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Electrochemistry', classId: 12, subject: 'Chemistry', percent: 3.30, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Chemical Kinetics', classId: 12, subject: 'Chemistry', percent: 3.61, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'd- & f-Block Elements', classId: 12, subject: 'Chemistry', percent: 4.69, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Coordination Compounds', classId: 12, subject: 'Chemistry', percent: 5.33, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Highest-yield inorganic chapter; heavily formula/rule driven, so fast to secure.' },
  { chapter: 'Haloalkanes & Haloarenes', classId: 12, subject: 'Chemistry', percent: 2.65, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Alcohols, Phenols & Ethers', classId: 12, subject: 'Chemistry', percent: 3.54, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Aldehydes, Ketones & Carboxylic Acids', classId: 12, subject: 'Chemistry', percent: 5.95, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Highest single Chemistry chapter across sources.' },
  { chapter: 'Amines', classId: 12, subject: 'Chemistry', percent: 4.40, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Biomolecules', classId: 12, subject: 'Chemistry', percent: 3.99, tier: 'high', confidence: 'high', foundational: false,
    note: 'Almost pure recall — very high marks per hour.' },
  // Added once the syllabus check showed these are examined but were absent
  // from SYLLABUS_DATA. See EXAM_EXTRA_CHAPTERS in constants.tsx.
  { chapter: 'Purification & Characterisation of Organic Compounds', classId: 11, subject: 'Chemistry', percent: 1.94, tier: 'low', confidence: 'medium', foundational: false,
    note: 'Small and heavily formula-based (Duma, Kjeldahl, Carius) — cheap marks.' },
  { chapter: 'The p-Block Elements (Groups 15-18)', classId: 12, subject: 'Chemistry', percent: 3.68, tier: 'high', confidence: 'medium', foundational: false,
    note: 'Groups 13 & 14 were removed from the JEE syllabus; 15-18 remain.' },

  // ------------------------------------------------------------------ Maths 11
  { chapter: 'Sets', classId: 11, subject: 'Maths', percent: 1.00, tier: 'low', confidence: 'high', foundational: false },
  { chapter: 'Relations & Functions', classId: 11, subject: 'Maths', percent: 1.25, tier: 'low', confidence: 'medium', foundational: true,
    note: 'Sources report one combined figure for the Class 11 and 12 chapters; it is attributed to both.' },
  { chapter: 'Trigonometric Functions', classId: 11, subject: 'Maths', percent: 2.37, tier: 'medium', confidence: 'medium', foundational: true,
    mergedFrom: ['Trigonometric Ratios and Identities (1.02)', 'Trigonometric Equations (1.35)'] },
  { chapter: 'Complex Numbers & Quadratic Equations', classId: 11, subject: 'Maths', percent: 8.05, tier: 'critical', confidence: 'medium', foundational: false,
    mergedFrom: ['Complex Number (4.75)', 'Quadratic Equations (3.30)'] },
  { chapter: 'Linear Inequalities', classId: 11, subject: 'Maths', percent: 0.3, tier: 'low', confidence: 'low', foundational: false,
    note: 'Absent from every source table. Figure is an assumption, not evidence — do not display as measured.' },
  { chapter: 'Permutations & Combinations', classId: 11, subject: 'Maths', percent: 3.60, tier: 'high', confidence: 'high', foundational: true },
  { chapter: 'Binomial Theorem', classId: 11, subject: 'Maths', percent: 5.05, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Sequences & Series', classId: 11, subject: 'Maths', percent: 5.74, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Straight Lines', classId: 11, subject: 'Maths', percent: 2.71, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Conic Sections', classId: 11, subject: 'Maths', percent: 9.44, tier: 'critical', confidence: 'medium', foundational: false,
    mergedFrom: ['Circles (3.24)', 'Parabola (2.44)', 'Ellipse (2.11)', 'Hyperbola (1.65)'],
    note: 'Largest single block in Maths once the four conics are combined.' },
  { chapter: 'Introduction to 3D Geometry', classId: 11, subject: 'Maths', percent: 0.5, tier: 'low', confidence: 'low', foundational: true,
    note: 'Not separated from the Class 12 3D chapter in any source. Prerequisite for it.' },
  { chapter: 'Limits & Derivatives', classId: 11, subject: 'Maths', percent: 5.50, tier: 'critical', confidence: 'medium', foundational: true,
    note: 'Reported jointly with Class 12 Continuity & Differentiability; the two share this figure.' },
  { chapter: 'Statistics', classId: 11, subject: 'Maths', percent: 3.00, tier: 'high', confidence: 'high', foundational: false,
    note: 'Small syllabus, reliable question — strong marks per hour.' },
  { chapter: 'Probability', classId: 11, subject: 'Maths', percent: 3.09, tier: 'high', confidence: 'medium', foundational: false,
    note: 'Reported jointly with the Class 12 chapter.' },

  // ------------------------------------------------------------------ Maths 12
  { chapter: 'Relations & Functions', classId: 12, subject: 'Maths', percent: 1.25, tier: 'low', confidence: 'medium', foundational: true },
  { chapter: 'Inverse Trigonometric Functions', classId: 12, subject: 'Maths', percent: 1.59, tier: 'low', confidence: 'high', foundational: false },
  { chapter: 'Matrices', classId: 12, subject: 'Maths', percent: 3.46, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Determinants', classId: 12, subject: 'Maths', percent: 4.00, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Continuity & Differentiability', classId: 12, subject: 'Maths', percent: 6.74, tier: 'critical', confidence: 'medium', foundational: true,
    mergedFrom: ['Limit, Continuity and Differentiability (5.50)', 'Methods of Differentiation (1.24)'] },
  { chapter: 'Applications of Derivatives', classId: 12, subject: 'Maths', percent: 4.75, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Integrals', classId: 12, subject: 'Maths', percent: 6.73, tier: 'critical', confidence: 'medium', foundational: true,
    mergedFrom: ['Indefinite Integration (1.65)', 'Definite Integration (5.08)'] },
  { chapter: 'Applications of Integrals', classId: 12, subject: 'Maths', percent: 2.97, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Differential Equations', classId: 12, subject: 'Maths', percent: 4.16, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Vector Algebra', classId: 12, subject: 'Maths', percent: 4.69, tier: 'critical', confidence: 'high', foundational: true },
  { chapter: 'Three Dimensional Geometry', classId: 12, subject: 'Maths', percent: 7.35, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Highest single Maths chapter across sources.' },
  { chapter: 'Linear Programming', classId: 12, subject: 'Maths', percent: 0.3, tier: 'low', confidence: 'low', foundational: false,
    note: 'Absent from source tables; commonly reported as roughly one question or none. Figure is an assumption.' },
  { chapter: 'Probability', classId: 12, subject: 'Maths', percent: 3.09, tier: 'high', confidence: 'medium', foundational: false },
];

/** Every chapter in SYLLABUS_DATA must have a row, or the grid will render
    chapters with no weightage badge. Used by scripts/checkContent.ts. */
export const weightageFor = (
  classId: 11 | 12,
  subject: string,
  chapter: string,
): ChapterWeight | undefined =>
  JEE_WEIGHTAGE.find(
    (w) => w.classId === classId && w.subject === subject && w.chapter === chapter,
  );
