/**
 * Topics within chapters — the unit the coach actually recommends.
 *
 * "Revise Electrostatics" is not an instruction anyone can act on at 9pm.
 * "Explain why field inside a conductor is zero — 25 min" is. These are the
 * smallest pieces of syllabus that make sense as a single sitting.
 *
 * PILOT COVERAGE: 17 chapters, the heaviest in each subject for each exam.
 * Chapters without topics still get recommended — the coach falls back to
 * chapter-level advice rather than going silent (see today/recommend.ts).
 *
 * `minutes` is a realistic single-sitting estimate for a student who has
 * already met the material once. First-pass learning takes longer, and the
 * coach scales for that. These are judgement calls, not sourced figures.
 */

import { ContentSubject } from './types';

/**
 * How the topic should be worked, which decides the instruction wording.
 *
 * `concept`    — explain it out loud in plain words (Feynman). Gaps surface
 *                exactly where you stall.
 * `derivation` — reproduce it on blank paper from scratch.
 * `numerical`  — problem reps; understanding it is not the same as being fast.
 * `recall`     — dump from memory, then check. For fact-dense material where
 *                explanation adds nothing.
 */
export type TopicKind = 'concept' | 'derivation' | 'numerical' | 'recall';

export interface Topic {
  id: string;
  chapter: string;
  classId: 11 | 12;
  subject: ContentSubject;
  name: string;
  minutes: number;
  kind: TopicKind;
}

type Row = [name: string, minutes: number, kind: TopicKind];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const chapterTopics = (
  subject: ContentSubject,
  classId: 11 | 12,
  chapter: string,
  rows: Row[],
): Topic[] =>
  rows.map(([name, minutes, kind]) => ({
    id: `${subject[0].toLowerCase()}${classId}-${slug(chapter)}-${slug(name)}`,
    chapter, classId, subject, name, minutes, kind,
  }));

export const TOPICS: Topic[] = [
  // ------------------------------------------------------------------ Physics
  ...chapterTopics('Physics', 12, 'Current Electricity', [
    ['Drift velocity and the origin of Ohm’s law', 30, 'concept'],
    ['Resistivity, its temperature dependence, and why semiconductors invert it', 25, 'concept'],
    ['Combining resistances in symmetric networks', 40, 'numerical'],
    ['EMF, internal resistance and terminal potential difference', 30, 'concept'],
    ['Kirchhoff’s rules on two-loop circuits', 45, 'numerical'],
    ['Wheatstone bridge and the meter bridge balance condition', 35, 'numerical'],
    ['Potentiometer: comparing EMFs and finding internal resistance', 35, 'concept'],
  ]),
  ...chapterTopics('Physics', 11, 'System of Particles & Rotational Motion', [
    ['Centre of mass of discrete and continuous bodies', 30, 'numerical'],
    ['Moment of inertia of standard bodies', 25, 'recall'],
    ['Parallel and perpendicular axis theorems, and when each applies', 30, 'concept'],
    ['Torque, angular momentum and the condition for conservation', 35, 'concept'],
    ['Rolling without slipping: deriving a = g sinθ/(1 + I/mR²)', 40, 'derivation'],
    ['Rolling problems: acceleration, friction and minimum μ', 45, 'numerical'],
    ['Angular momentum conservation in changing-inertia systems', 30, 'concept'],
  ]),
  ...chapterTopics('Physics', 12, 'Ray Optics & Optical Instruments', [
    ['Sign convention, and applying it without slipping', 20, 'concept'],
    ['Mirror formula and magnification', 30, 'numerical'],
    ['Lens maker’s formula, including a lens in a medium', 35, 'derivation'],
    ['Lens and mirror combinations: tracking the image through', 45, 'numerical'],
    ['Total internal reflection and the critical angle', 25, 'concept'],
    ['Prism: deviation, and the minimum-deviation condition', 35, 'derivation'],
    ['Microscope and telescope magnification', 30, 'recall'],
  ]),
  ...chapterTopics('Physics', 12, 'Electrostatic Potential & Capacitance', [
    ['Potential due to point charges and continuous distributions', 35, 'numerical'],
    ['Equipotential surfaces and why field is perpendicular to them', 25, 'concept'],
    ['Conductors in electrostatic equilibrium: why the interior field is zero', 30, 'concept'],
    ['Capacitance of parallel plate, spherical and cylindrical capacitors', 35, 'derivation'],
    ['Dielectrics, polarisation and the effect on capacitance', 30, 'concept'],
    ['Capacitor networks and energy stored', 40, 'numerical'],
  ]),
  ...chapterTopics('Physics', 12, 'Semiconductor Electronics', [
    ['Intrinsic vs extrinsic semiconductors, n-type and p-type', 25, 'concept'],
    ['The p-n junction, depletion region and barrier potential', 30, 'concept'],
    ['Diode characteristics under forward and reverse bias', 25, 'concept'],
    ['Half-wave and full-wave rectifiers', 30, 'concept'],
    ['Zener diode as a voltage regulator', 25, 'concept'],
    ['Logic gates and their truth tables', 20, 'recall'],
  ]),
  ...chapterTopics('Physics', 11, 'Units & Measurements', [
    ['Dimensional analysis and checking equation consistency', 25, 'concept'],
    ['Deriving relations by the dimensional method, and its limits', 30, 'concept'],
    ['Significant figures and rounding rules', 20, 'recall'],
    ['Combination of errors in sums, products and powers', 35, 'numerical'],
  ]),

  // ---------------------------------------------------------------- Chemistry
  ...chapterTopics('Chemistry', 12, 'Aldehydes, Ketones & Carboxylic Acids', [
    ['Nucleophilic addition and the reactivity order', 30, 'concept'],
    ['Aldol and cross-aldol condensation', 35, 'concept'],
    ['Cannizzaro reaction and the no-α-hydrogen requirement', 25, 'concept'],
    ['Clemmensen vs Wolff–Kishner: choosing by medium', 20, 'recall'],
    ['Distinguishing tests: Tollens, Fehling, iodoform', 25, 'recall'],
    ['Acidity of carboxylic acids and substituent effects', 30, 'concept'],
    ['Conversion sequences and naming the reagent at each arrow', 45, 'numerical'],
  ]),
  ...chapterTopics('Chemistry', 12, 'Coordination Compounds', [
    ['IUPAC nomenclature of complexes', 30, 'recall'],
    ['Oxidation state, coordination number and EAN', 25, 'numerical'],
    ['Crystal field theory: splitting in octahedral and tetrahedral fields', 40, 'concept'],
    ['Spectrochemical series, high spin vs low spin', 30, 'recall'],
    ['Magnetic moment from unpaired electrons', 25, 'numerical'],
    ['Counting isomers: geometrical, optical and linkage', 40, 'numerical'],
    ['VBT hybridisation and predicting geometry', 35, 'concept'],
  ]),
  ...chapterTopics('Chemistry', 11, 'Chemical Bonding & Molecular Structure', [
    ['Ionic vs covalent character, Fajans’ rules', 25, 'concept'],
    ['VSEPR: predicting shape and bond angles', 35, 'concept'],
    ['Hybridisation and its relation to geometry', 30, 'concept'],
    ['Molecular orbital theory for diatomics, bond order', 40, 'concept'],
    ['Hydrogen bonding and its physical consequences', 25, 'concept'],
    ['Dipole moment and molecular polarity', 25, 'numerical'],
  ]),
  ...chapterTopics('Chemistry', 11, 'Equilibrium', [
    ['Kp, Kc and the relation between them', 30, 'numerical'],
    ['Le Chatelier’s principle applied to real shifts', 25, 'concept'],
    ['Ionic equilibrium: pH, pOH and strong/weak distinctions', 35, 'numerical'],
    ['Buffers and the Henderson–Hasselbalch equation', 35, 'numerical'],
    ['Solubility product and the common ion effect', 35, 'numerical'],
    ['Salt hydrolysis and predicting the resulting pH', 30, 'concept'],
  ]),

  // -------------------------------------------------------------------- Maths
  ...chapterTopics('Maths', 12, 'Three Dimensional Geometry', [
    ['Direction cosines and direction ratios', 25, 'concept'],
    ['Equation of a line in vector and Cartesian form', 30, 'concept'],
    ['Equation of a plane, and the meaning of the normal vector', 30, 'concept'],
    ['Angle between lines, planes, and a line and a plane', 30, 'recall'],
    ['Shortest distance between skew lines', 40, 'numerical'],
    ['Foot of perpendicular and image of a point in a plane', 40, 'numerical'],
  ]),
  ...chapterTopics('Maths', 11, 'Conic Sections', [
    ['Circle: equation, tangent and chord of contact', 35, 'numerical'],
    ['Parabola: standard form, focus, directrix, latus rectum', 30, 'concept'],
    ['Ellipse: eccentricity, foci, and the b > a case', 35, 'concept'],
    ['Hyperbola: eccentricity, asymptotes, conjugate hyperbola', 35, 'concept'],
    ['Tangent and normal conditions across all conics', 40, 'numerical'],
    ['Reducing a general second-degree equation by completing the square', 35, 'numerical'],
  ]),
  ...chapterTopics('Maths', 12, 'Continuity & Differentiability', [
    ['Continuity at a point, and classifying discontinuities', 30, 'concept'],
    ['Differentiability, and why it implies continuity but not conversely', 30, 'concept'],
    ['Chain rule on nested and composite functions', 35, 'numerical'],
    ['Implicit and parametric differentiation', 35, 'numerical'],
    ['Logarithmic differentiation', 25, 'numerical'],
    ['Rolle’s and Lagrange’s mean value theorems', 30, 'concept'],
  ]),
  ...chapterTopics('Maths', 12, 'Integrals', [
    ['Standard integrals worth knowing cold', 25, 'recall'],
    ['Integration by substitution', 35, 'numerical'],
    ['Integration by parts and the ILATE order', 35, 'numerical'],
    ['Partial fractions', 35, 'numerical'],
    ['Definite integral properties, especially the symmetry ones', 40, 'concept'],
    ['Definite integral as the limit of a sum', 30, 'derivation'],
  ]),

  // ------------------------------------------------------------------ Biology
  ...chapterTopics('Biology', 12, 'Molecular Basis of Inheritance', [
    ['DNA structure and the numbers: 34 Å, 3.4 Å, 10 bp', 25, 'recall'],
    ['The experiments: Griffith, Avery, Hershey–Chase, Meselson–Stahl', 35, 'recall'],
    ['Replication: enzymes, leading and lagging strands', 35, 'concept'],
    ['Transcription in prokaryotes vs eukaryotes', 35, 'concept'],
    ['Genetic code and its properties', 25, 'recall'],
    ['Translation: initiation, elongation, termination', 30, 'concept'],
    ['lac operon regulation with and without lactose', 30, 'concept'],
  ]),
  ...chapterTopics('Biology', 11, 'Animal Kingdom', [
    ['Basis of classification: symmetry, coelom, germ layers', 30, 'concept'],
    ['Porifera through Ctenophora: distinguishing features', 30, 'recall'],
    ['Platyhelminthes, Aschelminthes, Annelida', 35, 'recall'],
    ['Arthropoda and Mollusca: examples and features', 35, 'recall'],
    ['Echinodermata and Hemichordata', 25, 'recall'],
    ['Chordate classes and their defining characters', 40, 'recall'],
  ]),
  ...chapterTopics('Biology', 12, 'Principles of Inheritance and Variation', [
    ['Mendel’s laws and the monohybrid/dihybrid ratios', 30, 'concept'],
    ['Deviations: incomplete dominance, codominance, multiple alleles', 30, 'concept'],
    ['Polygenic inheritance and pleiotropy', 25, 'concept'],
    ['Linkage, recombination and gene mapping', 35, 'concept'],
    ['Sex determination and sex-linked inheritance', 30, 'concept'],
    ['Pedigree analysis', 35, 'numerical'],
    ['Genetic disorders: Mendelian and chromosomal', 30, 'recall'],
  ]),
];

export const topicsForChapter = (classId: 11 | 12, subject: string, chapter: string): Topic[] =>
  TOPICS.filter((t) => t.classId === classId && t.subject === subject && t.chapter === chapter);

export const CHAPTERS_WITH_TOPICS = new Set(TOPICS.map((t) => `${t.classId}|${t.subject}|${t.chapter}`));
