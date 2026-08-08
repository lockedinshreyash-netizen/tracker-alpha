/**
 * NEET chapter weightage — consensus of published PYQ analyses.
 *
 * Methodology, source clusters and known limits: content/SOURCES.md.
 *
 * NEET is cleanly four sections of 45 questions each — Botany, Zoology,
 * Physics, Chemistry — so unlike JEE, `percent` values ARE directly comparable
 * across subjects. A 10% Botany chapter and a 10% Physics chapter are worth the
 * same marks. Cross-subject prioritisation is therefore valid here.
 *
 * Tier thresholds (percent of the chapter's own 45-question section):
 *   critical >= 7 | high 5-6.9 | medium 3-4.9 | low < 3
 * These are NOT the JEE thresholds — the NEET scale runs roughly twice as high
 * because each section has half as many chapters competing for it.
 */

import { ChapterWeight, SourceCluster } from './types';

export const NEET_SOURCE_CLUSTERS: SourceCluster[] = [
  {
    id: 'neet-a',
    sites: ['rosemaryinstitute.com'],
    basis: 'NEET 2020–2024, with sample sizes stated per subject: 257 Botany, 264 Zoology, 263 Chemistry, 252 Physics questions. Splits Biology into Botany/Zoology as the paper does. Chapter list matches the current rationalised syllabus with no removed chapters present.',
    granularity: 'chapter',
    // Botany rows sum to 94%, Zoology to 102%, Physics to 97% — all ~100 within
    // rounding. The only dataset found for either exam that is both current and
    // internally consistent.
    sumsTo100: { Biology: true, Physics: true, Chemistry: true },
  },
  {
    id: 'neet-b',
    sites: ['store.pw.live'],
    basis: 'No basis stated. Unit-level (Human Physiology, Genetics and Evolution, Ecology). Used only to corroborate neet-a, never as a primary figure.',
    granularity: 'unit',
    sumsTo100: {},
  },
  {
    id: 'neet-c-excluded',
    sites: ['careerpower.in'],
    basis: 'EXCLUDED. Reports the obsolete 200-question paper pattern ("Physics 50 questions", "Chemistry 35 Section A + 15 Section B") that NEET dropped in 2025, and its Biology table still contains Transport in Plants, Mineral Nutrition, Digestion and Absorption, Reproduction in Organisms, Strategies for Enhancement in Food Production and Environmental Issues — all removed from the syllabus. Stale on both the syllabus and the paper structure.',
    granularity: 'chapter',
    sumsTo100: {},
  },
];

export const NEET_WEIGHTAGE_COMPILED_ON = '2026-08-08';

export const NEET_WEIGHTAGE: ChapterWeight[] = [
  // ============================================================ BIOLOGY — BOTANY
  { chapter: 'Molecular Basis of Inheritance', classId: 12, subject: 'Biology', stream: 'botany', percent: 14, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Highest-weightage chapter in the entire NEET paper.' },
  { chapter: 'Principles of Inheritance and Variation', classId: 12, subject: 'Biology', stream: 'botany', percent: 10, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Cell Cycle and Cell Division', classId: 11, subject: 'Biology', stream: 'botany', percent: 9, tier: 'critical', confidence: 'high', foundational: true },
  { chapter: 'Anatomy of Flowering Plants', classId: 11, subject: 'Biology', stream: 'botany', percent: 7, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Plant Kingdom', classId: 11, subject: 'Biology', stream: 'botany', percent: 7, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Morphology of Flowering Plants', classId: 11, subject: 'Biology', stream: 'botany', percent: 6, tier: 'high', confidence: 'high', foundational: true,
    note: 'Terminology here is assumed by the rest of botany.' },
  { chapter: 'Sexual Reproduction in Flowering Plants', classId: 12, subject: 'Biology', stream: 'botany', percent: 6, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Plant Growth and Development', classId: 11, subject: 'Biology', stream: 'botany', percent: 6, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Cell: The Unit of Life', classId: 11, subject: 'Biology', stream: 'botany', percent: 5, tier: 'high', confidence: 'high', foundational: true },
  { chapter: 'Biodiversity and Conservation', classId: 12, subject: 'Biology', stream: 'botany', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Respiration in Plants', classId: 11, subject: 'Biology', stream: 'botany', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Microbes in Human Welfare', classId: 12, subject: 'Biology', stream: 'botany', percent: 4, tier: 'medium', confidence: 'high', foundational: false,
    note: 'Almost pure recall — high marks per hour.' },
  { chapter: 'Ecosystem', classId: 12, subject: 'Biology', stream: 'botany', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Organisms and Populations', classId: 12, subject: 'Biology', stream: 'botany', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Photosynthesis in Higher Plants', classId: 11, subject: 'Biology', stream: 'botany', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Biological Classification', classId: 11, subject: 'Biology', stream: 'botany', percent: 3, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'The Living World', classId: 11, subject: 'Biology', stream: 'botany', percent: 1, tier: 'low', confidence: 'high', foundational: true,
    note: 'Lowest-yield chapter in Biology, but taxonomy vocabulary is assumed later.' },

  // =========================================================== BIOLOGY — ZOOLOGY
  { chapter: 'Animal Kingdom', classId: 11, subject: 'Biology', stream: 'zoology', percent: 13, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Largest Zoology chapter; heavy on non-chordate classification detail.' },
  { chapter: 'Biotechnology: Principles and Processes', classId: 12, subject: 'Biology', stream: 'zoology', percent: 12, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Biomolecules', classId: 11, subject: 'Biology', stream: 'zoology', percent: 10, tier: 'critical', confidence: 'high', foundational: true },
  { chapter: 'Structural Organisation in Animals', classId: 11, subject: 'Biology', stream: 'zoology', percent: 8, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Reproductive Health', classId: 12, subject: 'Biology', stream: 'zoology', percent: 8, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Far higher yield than students expect for its size.' },
  { chapter: 'Biotechnology and its Applications', classId: 12, subject: 'Biology', stream: 'zoology', percent: 7, tier: 'critical', confidence: 'high', foundational: false },
  { chapter: 'Locomotion and Movement', classId: 11, subject: 'Biology', stream: 'zoology', percent: 6, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Evolution', classId: 12, subject: 'Biology', stream: 'zoology', percent: 6, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Human Reproduction', classId: 12, subject: 'Biology', stream: 'zoology', percent: 6, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Human Health and Disease', classId: 12, subject: 'Biology', stream: 'zoology', percent: 6, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Body Fluids and Circulation', classId: 11, subject: 'Biology', stream: 'zoology', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Excretory Products and their Elimination', classId: 11, subject: 'Biology', stream: 'zoology', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Breathing and Exchange of Gases', classId: 11, subject: 'Biology', stream: 'zoology', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Chemical Coordination and Integration', classId: 11, subject: 'Biology', stream: 'zoology', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Neural Control and Coordination', classId: 11, subject: 'Biology', stream: 'zoology', percent: 2, tier: 'low', confidence: 'medium', foundational: false,
    note: 'Surprisingly low in the 2020–2024 count given its size and reputation. Corroborating source is unit-level so cannot confirm. Treat the tier as provisional.' },

  // ==================================================================== PHYSICS
  { chapter: 'Units & Measurements', classId: 11, subject: 'Physics', percent: 5, tier: 'high', confidence: 'high', foundational: true },
  { chapter: 'Motion in a Straight Line', classId: 11, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Motion in a Plane', classId: 11, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Laws of Motion', classId: 11, subject: 'Physics', percent: 2, tier: 'low', confidence: 'high', foundational: true,
    note: 'Low direct count, embedded in most mechanics questions. Never present as skippable.' },
  { chapter: 'Work, Energy & Power', classId: 11, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'System of Particles & Rotational Motion', classId: 11, subject: 'Physics', percent: 8, tier: 'critical', confidence: 'medium', foundational: false,
    mergedFrom: ['Rotational Motion (6)', 'Center of Mass & System of Particles (2)'],
    note: 'Biggest mechanics block in NEET Physics.' },
  { chapter: 'Gravitation', classId: 11, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Mechanical Properties of Solids', classId: 11, subject: 'Physics', percent: 2, tier: 'low', confidence: 'high', foundational: false },
  { chapter: 'Mechanical Properties of Fluids', classId: 11, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Thermal Properties of Matter', classId: 11, subject: 'Physics', percent: 1, tier: 'low', confidence: 'high', foundational: false },
  { chapter: 'Thermodynamics', classId: 11, subject: 'Physics', percent: 2, tier: 'low', confidence: 'low', foundational: false,
    note: 'CONFLICT: the excluded stale source rates this 9% — the largest disagreement found in either exam. neet-a counts it at 2% over 2020–2024. Do not surface a percentage for this chapter until a third dataset settles it.' },
  { chapter: 'Kinetic Theory', classId: 11, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Oscillations', classId: 11, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Waves', classId: 11, subject: 'Physics', percent: 1, tier: 'low', confidence: 'high', foundational: false },
  { chapter: 'Electric Charges & Fields', classId: 12, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Electrostatic Potential & Capacitance', classId: 12, subject: 'Physics', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Current Electricity', classId: 12, subject: 'Physics', percent: 10, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Highest Physics chapter in both NEET and JEE. Both independent NEET datasets agree at 10%.' },
  { chapter: 'Moving Charges & Magnetism', classId: 12, subject: 'Physics', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Magnetism & Matter', classId: 12, subject: 'Physics', percent: 1, tier: 'low', confidence: 'high', foundational: false },
  { chapter: 'Electromagnetic Induction', classId: 12, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Alternating Current', classId: 12, subject: 'Physics', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Electromagnetic Waves', classId: 12, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: false,
    note: 'Tiny chapter, pure recall — best marks per hour in NEET Physics.' },
  { chapter: 'Ray Optics & Optical Instruments', classId: 12, subject: 'Physics', percent: 6, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Wave Optics', classId: 12, subject: 'Physics', percent: 2, tier: 'low', confidence: 'high', foundational: false },
  { chapter: 'Dual Nature of Radiation & Matter', classId: 12, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'low', foundational: false,
    note: 'Absent from neet-a\'s table entirely. Figure taken from the unit-level corroborating source alone. Weakest row in the NEET Physics set.' },
  { chapter: 'Atoms', classId: 12, subject: 'Physics', percent: 3, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Nuclei', classId: 12, subject: 'Physics', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Semiconductor Electronics', classId: 12, subject: 'Physics', percent: 5, tier: 'high', confidence: 'high', foundational: false },

  // ================================================================== CHEMISTRY
  { chapter: 'Some Basic Concepts of Chemistry', classId: 11, subject: 'Chemistry', percent: 4, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Structure of Atom', classId: 11, subject: 'Chemistry', percent: 4, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Classification of Elements & Periodicity', classId: 11, subject: 'Chemistry', percent: 2, tier: 'low', confidence: 'high', foundational: true,
    note: 'Low direct weight; periodic trends are assumed across all of inorganic.' },
  { chapter: 'Chemical Bonding & Molecular Structure', classId: 11, subject: 'Chemistry', percent: 7, tier: 'critical', confidence: 'high', foundational: true },
  { chapter: 'Thermodynamics', classId: 11, subject: 'Chemistry', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Equilibrium', classId: 11, subject: 'Chemistry', percent: 6, tier: 'high', confidence: 'high', foundational: true },
  { chapter: 'Redox Reactions', classId: 11, subject: 'Chemistry', percent: 3, tier: 'medium', confidence: 'high', foundational: true },
  { chapter: 'Organic Chemistry: Basic Principles & Techniques', classId: 11, subject: 'Chemistry', percent: 5, tier: 'high', confidence: 'high', foundational: true,
    note: 'NEET examines this directly far more than JEE does (5% vs ~1.6%). Foundational either way.' },
  { chapter: 'Hydrocarbons', classId: 11, subject: 'Chemistry', percent: 7, tier: 'critical', confidence: 'high', foundational: true },
  { chapter: 'Solutions', classId: 12, subject: 'Chemistry', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Electrochemistry', classId: 12, subject: 'Chemistry', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Chemical Kinetics', classId: 12, subject: 'Chemistry', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'd- & f-Block Elements', classId: 12, subject: 'Chemistry', percent: 6, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Coordination Compounds', classId: 12, subject: 'Chemistry', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Haloalkanes & Haloarenes', classId: 12, subject: 'Chemistry', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Alcohols, Phenols & Ethers', classId: 12, subject: 'Chemistry', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  { chapter: 'Aldehydes, Ketones & Carboxylic Acids', classId: 12, subject: 'Chemistry', percent: 9, tier: 'critical', confidence: 'high', foundational: false,
    note: 'Highest Chemistry chapter in both exams.' },
  { chapter: 'Amines', classId: 12, subject: 'Chemistry', percent: 5, tier: 'high', confidence: 'high', foundational: false },
  { chapter: 'Biomolecules', classId: 12, subject: 'Chemistry', percent: 4, tier: 'medium', confidence: 'high', foundational: false },
  // Inorganic chapters NEET retains that JEE dropped. Absent from SYLLABUS_DATA
  // until the syllabus check caught it — see EXAM_EXTRA_CHAPTERS in constants.tsx.
  { chapter: 'The p-Block Elements (Groups 13 & 14)', classId: 11, subject: 'Chemistry', percent: 6, tier: 'high', confidence: 'medium', foundational: false,
    note: 'neet-a reports p-Block at 12% total, split evenly across the two class groups. Cut from NCERT but explicitly retained in the NEET syllabus.' },
  { chapter: 's-Block Elements', classId: 11, subject: 'Chemistry', percent: 3, tier: 'medium', confidence: 'low', foundational: false,
    note: 'Retained for NEET, removed for JEE. Figure from the corroborating source only.' },
  { chapter: 'Hydrogen', classId: 11, subject: 'Chemistry', percent: 2, tier: 'low', confidence: 'low', foundational: false,
    note: 'Retained for NEET, removed for JEE. Figure from the corroborating source only.' },
  { chapter: 'The p-Block Elements (Groups 15-18)', classId: 12, subject: 'Chemistry', percent: 6, tier: 'high', confidence: 'medium', foundational: false },
];

export const neetWeightageFor = (
  classId: 11 | 12,
  subject: string,
  chapter: string,
): ChapterWeight | undefined =>
  NEET_WEIGHTAGE.find(
    (w) => w.classId === classId && w.subject === subject && w.chapter === chapter,
  );
