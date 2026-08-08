/**
 * One-page revision sheets — the "night before" content.
 *
 * PILOT COVERAGE. Eight chapters are authored, chosen as the highest-weightage
 * chapter in each subject/exam combination. Every other chapter renders an
 * honest "not authored yet" state rather than a fabricated sheet — a revision
 * sheet with invented formulas is worse than no sheet at all.
 *
 * Notes are exam-agnostic (keyed on class + subject + chapter) because the
 * physics of Current Electricity does not change between JEE and NEET. Only
 * which chapters are *shown* differs, and that is handled upstream.
 *
 * `traps` is the highest-value and lowest-confidence field: it comes from
 * working problems, not from any published table. Treat additions here as
 * needing a second pair of eyes.
 */

import { ContentSubject } from './types';

export interface RevisionNote {
  chapter: string;
  classId: 11 | 12;
  subject: ContentSubject;
  /** Formulas and facts that must be recallable cold. */
  mustKnow: string[];
  /** Mistakes that cost marks in questions students otherwise know how to do. */
  traps: string[];
  /** The recurring shapes a question takes. Tick-able: "I can solve this cold." */
  archetypes: string[];
}

export const REVISION_NOTES: RevisionNote[] = [
  {
    chapter: 'Current Electricity',
    classId: 12,
    subject: 'Physics',
    mustKnow: [
      'I = nAev_d  —  drift velocity is of order mm/s, the field establishes at ~c',
      'R = ρL/A,  ρ = m/(ne²τ)',
      'ρ_T = ρ₀[1 + α(T − T₀)]  —  α is negative for semiconductors',
      'Series: R = ΣR.  Parallel: 1/R = Σ(1/R)',
      'Terminal PD: V = ε − Ir discharging,  V = ε + Ir charging',
      'Cells in series: ε_eq = Σε, r_eq = Σr.  Parallel: ε_eq = (ε₁/r₁ + ε₂/r₂)/(1/r₁ + 1/r₂)',
      'Kirchhoff: junction rule = charge conservation, loop rule = energy conservation',
      'Wheatstone balance: P/Q = R/S  (no current through galvanometer)',
      'Meter bridge: R/S = l/(100 − l)',
      'Potentiometer: ε₁/ε₂ = l₁/l₂',
      'Max power transfer at R = r, giving P_max = ε²/4r',
    ],
    traps: [
      'Terminal voltage exceeds EMF while a cell is being charged — sign of Ir flips.',
      'A potentiometer draws no current at null, so it reads true EMF; a voltmeter never does.',
      'Resistivity of a semiconductor falls with temperature. Metals rise.',
      'Meter bridge is most accurate near the middle — that is why questions ask you to shift the balance point.',
      'Bulb "rating" is at its rated voltage; in series the actual power is not the rated power.',
    ],
    archetypes: [
      'Equivalent resistance of a symmetric network using Wheatstone balance or fold symmetry',
      'Meter bridge: how the balance point shifts when a resistance is changed',
      'Potentiometer: comparing two EMFs, or finding internal resistance',
      'Two-loop Kirchhoff problem for a branch current',
      'Bulb combinations: which glows brighter in series vs parallel',
    ],
  },
  {
    chapter: 'System of Particles & Rotational Motion',
    classId: 11,
    subject: 'Physics',
    mustKnow: [
      'R_cm = Σm_i r_i / Σm_i',
      'τ = r × F,  τ = Iα,  L = Iω',
      'MOI: rod (centre) ML²/12, rod (end) ML²/3, ring MR², disc ½MR², solid sphere ⅖MR², hollow sphere ⅔MR²',
      'Parallel axis: I = I_cm + Md²',
      'Perpendicular axis: I_z = I_x + I_y  —  planar laminae ONLY',
      'Rolling without slipping: v = ωR,  KE = ½mv²(1 + I/mR²)',
      'Rolling down an incline: a = g·sinθ / (1 + I/mR²)',
      'Minimum friction to roll: μ ≥ tanθ / (1 + mR²/I)',
      'L is conserved whenever τ_ext = 0',
    ],
    traps: [
      'a = g·sinθ is for sliding. Rolling ALWAYS carries the (1 + I/mR²) factor — the single most common error in this chapter.',
      'Perpendicular axis theorem does not apply to a sphere or a cylinder. Laminae only.',
      'Static friction in rolling without slipping does no work — do not deduct energy for it.',
      'Order down an incline is set by I/mR² alone: solid sphere fastest, ring slowest. Mass and radius cancel.',
    ],
    archetypes: [
      'MOI of a composite body, or a body with a portion removed, about an arbitrary axis',
      'Rolling on an incline: find acceleration, friction, or minimum μ',
      'Angular momentum conservation — person contracting arms on a rotating platform',
      'Particle striking a pivoted rod: find ω immediately after',
      'Pulley with appreciable mass: torque equation combined with Newton’s laws',
    ],
  },
  {
    chapter: 'Ray Optics & Optical Instruments',
    classId: 12,
    subject: 'Physics',
    mustKnow: [
      'Mirror: 1/v + 1/u = 1/f,  f = R/2,  m = −v/u',
      'Lens: 1/v − 1/u = 1/f,  m = v/u',
      'Lens maker: 1/f = (n − 1)(1/R₁ − 1/R₂)',
      'Single refracting surface: n₂/v − n₁/u = (n₂ − n₁)/R',
      'Power P = 1/f (metres); in combination P = P₁ + P₂',
      'Critical angle: sin C = 1/n',
      'Prism: A + δ = i + e;  at minimum deviation n = sin((A + δ_m)/2) / sin(A/2)',
      'Microscope: M = (v_o/u_o)(1 + D/f_e).  Telescope: M = f_o/f_e',
    ],
    traps: [
      'Mirror formula adds (1/v + 1/u); lens formula subtracts (1/v − 1/u). Swapping these is the most frequent slip in the chapter.',
      'Magnification is m = −v/u for mirrors but m = +v/u for lenses.',
      'A lens in a medium uses (n_lens/n_medium − 1), not (n − 1). A lens can even change sign of power in a denser medium.',
      'Apply the sign convention from the pole, measured along the incident direction, every single time.',
    ],
    archetypes: [
      'Lens and mirror in combination — track the image through both',
      'Prism at minimum deviation, or finding the critical angle for TIR',
      'Lens immersed in a liquid: new focal length or power',
      'Telescope/microscope magnification and tube length',
      'Silvered lens treated as an equivalent mirror',
    ],
  },
  {
    chapter: 'Aldehydes, Ketones & Carboxylic Acids',
    classId: 12,
    subject: 'Chemistry',
    mustKnow: [
      'Nucleophilic addition; reactivity HCHO > CH₃CHO > ketones (steric + electron-donating groups)',
      'Aldol: needs α-H.  Cannizzaro: needs NO α-H.',
      'Reduction: Clemmensen (Zn-Hg/HCl, acidic), Wolff–Kishner (NH₂NH₂/KOH, basic)',
      'Rosenmund: acyl chloride → aldehyde (H₂/Pd-BaSO₄)',
      'Gattermann–Koch: arene → aromatic aldehyde (CO/HCl, AlCl₃)',
      'HVZ: α-halogenation of carboxylic acids (X₂/red P)',
      'Acidity: carboxylic acid > phenol > alcohol; EWG raises acidity, EDG lowers it',
      'Tests: Tollens (Ag mirror), Fehling (red Cu₂O), Iodoform (CH₃CO– or CH₃CH(OH)–)',
    ],
    traps: [
      'Fehling’s gives a NEGATIVE result with aromatic aldehydes — benzaldehyde does not respond. Tollens’ does.',
      'Cannizzaro needs the absence of α-hydrogen: HCHO and benzaldehyde undergo it, acetaldehyde does not.',
      'Iodoform is positive for ethanol and acetaldehyde too, not just ketones — the CH₃CH(OH)– group counts.',
      'Ketones do not reduce Tollens’ reagent. That is the whole basis of the aldehyde/ketone distinction.',
    ],
    archetypes: [
      'Predict the product of an aldol or cross-aldol condensation',
      'Distinguish two given compounds using a single reagent',
      'Rank a set of acids by acidity with reasoning',
      'Multi-step conversion (A → B → C) naming reagents at each arrow',
      'Identify the unknown from a set of positive/negative test results',
    ],
  },
  {
    chapter: 'Coordination Compounds',
    classId: 12,
    subject: 'Chemistry',
    mustKnow: [
      'Spectrochemical series: CO > CN⁻ > NO₂⁻ > en > NH₃ > H₂O > OH⁻ > F⁻ > Cl⁻ > Br⁻ > I⁻',
      'CFSE = (−0.4·n_t2g + 0.6·n_eg)·Δ₀',
      'Magnetic moment μ = √(n(n + 2)) BM, n = unpaired electrons',
      'VBT: inner-orbital d²sp³ (low spin) vs outer-orbital sp³d² (high spin)',
      'Isomerism: geometrical, optical, ionisation, linkage, coordination, hydrate',
      'Ma₄b₂ octahedral → cis/trans.  Ma₃b₃ → fac/mer.',
      'Naming: ligands alphabetically, then metal; anionic complex takes the -ate suffix',
    ],
    traps: [
      '[Ni(CN)₄]²⁻ is square planar and diamagnetic; [NiCl₄]²⁻ is tetrahedral and paramagnetic. Same metal, same oxidation state, different geometry.',
      'Tetrahedral complexes are ALWAYS high spin — Δ_t is too small to pair. Never look for a low-spin tetrahedral.',
      'Square planar Ma₂b₂ shows geometrical isomerism; tetrahedral Ma₂b₂ does not.',
      'Count the oxidation state before the d-configuration. Getting the charge wrong invalidates everything downstream.',
    ],
    archetypes: [
      'Count unpaired electrons and calculate the magnetic moment',
      'Determine hybridisation and geometry from the ligand and metal',
      'Count the total number of isomers for a given formula',
      'Convert between IUPAC name and formula',
      'Compare Δ₀ / colour for two complexes of the same metal',
    ],
  },
  {
    chapter: 'Three Dimensional Geometry',
    classId: 12,
    subject: 'Maths',
    mustKnow: [
      'Direction cosines: l² + m² + n² = 1',
      'Line: (x − x₁)/a = (y − y₁)/b = (z − z₁)/c,  or  r = a + λb',
      'Plane: r·n̂ = d,  or  ax + by + cz + d = 0',
      'Angle between lines: cos θ = |b₁·b₂| / (|b₁||b₂|)',
      'Angle between line and plane: sin θ = |b·n| / (|b||n|)',
      'Distance point to plane: |ax₁ + by₁ + cz₁ + d| / √(a² + b² + c²)',
      'Shortest distance between skew lines: |(a₂ − a₁)·(b₁ × b₂)| / |b₁ × b₂|',
      'Coplanarity: (a₂ − a₁)·(b₁ × b₂) = 0',
    ],
    traps: [
      'Line-to-plane angle uses SINE; line-to-line and plane-to-plane use COSINE. This single swap is the most common error in the chapter.',
      'Check b₁ × b₂ = 0 first — if the lines are parallel the skew-distance formula is undefined and you need the parallel-line formula.',
      'The plane’s normal is the coefficient vector (a, b, c); do not use a point on the plane as the normal.',
    ],
    archetypes: [
      'Shortest distance between two skew lines',
      'Foot of perpendicular, or image of a point in a plane',
      'Equation of a plane through three points, or containing a given line',
      'Angle between two planes, or between a line and a plane',
      'Point of intersection of a line and a plane',
    ],
  },
  {
    chapter: 'Conic Sections',
    classId: 11,
    subject: 'Maths',
    mustKnow: [
      'Circle: (x − h)² + (y − k)² = r²',
      'Parabola y² = 4ax: focus (a, 0), directrix x = −a, LR = 4a, parametric (at², 2at)',
      'Ellipse x²/a² + y²/b² = 1: e² = 1 − b²/a², foci (±ae, 0), LR = 2b²/a',
      'Hyperbola x²/a² − y²/b² = 1: e² = 1 + b²/a², asymptotes y = ±(b/a)x, LR = 2b²/a',
      'Tangent to parabola: y = mx + a/m',
      'Tangent to ellipse: y = mx ± √(a²m² + b²)',
      'Sum of focal distances = 2a (ellipse); difference = 2a (hyperbola)',
    ],
    traps: [
      'e² = 1 − b²/a² for an ellipse but 1 + b²/a² for a hyperbola. The sign flip is the classic slip.',
      'If b > a in an ellipse the major axis is along y — the foci move to (0, ±be). Always compare a and b before writing foci.',
      'Complete the square first. Most questions hand you a shifted conic, and reading a and b off the raw equation gives the wrong answer.',
    ],
    archetypes: [
      'Tangent or normal from an external point',
      'Find eccentricity, foci or directrix after completing the square',
      'Chord of contact, or pair of tangents from a point',
      'Locus of the midpoint of a chord',
      'Condition for a line to be tangent to a given conic',
    ],
  },
  {
    chapter: 'Molecular Basis of Inheritance',
    classId: 12,
    subject: 'Biology',
    mustKnow: [
      'B-DNA: 20 Å diameter, pitch 34 Å, 10 bp per turn, 3.4 Å rise per bp',
      'Chargaff: A = T, G = C',
      'Griffith → transforming principle; Avery–MacLeod–McCarty → it is DNA; Hershey–Chase → confirmed with ³²P (DNA) and ³⁵S (protein)',
      'Meselson–Stahl: semiconservative replication, E. coli with ¹⁵N',
      'Replication: DNA polymerase III, 5′→3′ only, leading strand continuous, lagging in Okazaki fragments joined by ligase',
      'Transcription (prokaryote): RNA polymerase + σ for initiation, ρ for termination',
      'Eukaryote: RNA pol I (rRNA), II (hnRNA), III (tRNA); hnRNA is capped, tailed and spliced',
      'Genetic code: 64 codons, degenerate, unambiguous, near-universal; start AUG; stop UAA, UAG, UGA',
      'lac operon: i, p, o, z, y, a — negatively regulated and inducible, lactose is the inducer',
    ],
    traps: [
      'Hershey–Chase used ³²P to label DNA and ³⁵S to label protein. Reversing these is the single most common error on this chapter.',
      'Rise per base pair is 3.4 Å; the full turn is 34 Å. Length calculations go wrong by 10× when these are confused.',
      'lac operon is inducible and negatively regulated; trp operon is repressible. Do not mix the two.',
      'Meselson–Stahl was done in E. coli. The eukaryotic demonstration was Taylor, in Vicia faba.',
    ],
    archetypes: [
      'Calculate DNA length, or number of base pairs, from given data',
      'Match the experiment to what it actually proved, and in what order',
      'Predict lac operon behaviour with lactose present vs absent',
      'Codon/anticodon pairing and reading-frame questions',
      'Identify the enzyme acting at a named step of replication or transcription',
    ],
  },
];

export const revisionNoteFor = (
  classId: 11 | 12,
  subject: string,
  chapter: string,
): RevisionNote | undefined =>
  REVISION_NOTES.find(
    (n) => n.classId === classId && n.subject === subject && n.chapter === chapter,
  );
