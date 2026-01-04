
import { Subject, SyllabusStatus } from './types';

export const JEE_2027_DATE = new Date('2027-01-01'); 

export const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Maths'];

export const LOCK_IN_QUOTES = [
  "THE COMPETITION IS STUDYING. ARE YOU?",
  "ONE CHAPTER TODAY. ONE RANK TOMORROW.",
  "EVERY SECOND WASTED IS A STEP BACKWARD.",
  "AIR 1 IS EARNED IN THE SILENCE OF DEEP FOCUS.",
  "DISCIPLINE IS THE BRIDGE BETWEEN GOALS AND ACHIEVEMENT.",
  "RESPECT THE SCHEDULE. IGNORE THE NOISE.",
  "YOU ARE ALONE WITH YOUR DREAMS. PROTECT THEM.",
  "STAY FOCUSED. STAY DETERMINED."
];

export const STATUS_CYCLE: SyllabusStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'revision_pending'
];

export const STATUS_LABELS: Record<SyllabusStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  revision_pending: 'Revision'
};

export const STATUS_COLORS: Record<SyllabusStatus, { border: string, bg: string, text: string, label: string, dot: string }> = {
  not_started: {
    border: 'border-zinc-800',
    bg: 'bg-transparent',
    text: 'text-zinc-500',
    label: 'border-zinc-800 text-zinc-600',
    dot: 'bg-zinc-800'
  },
  in_progress: {
    border: 'border-yellow-600/50',
    bg: 'bg-yellow-600/5',
    text: 'text-yellow-500',
    label: 'border-yellow-600/50 text-yellow-600',
    dot: 'bg-yellow-500'
  },
  completed: {
    border: 'border-green-600/50',
    bg: 'bg-green-600/10',
    text: 'text-green-500',
    label: 'border-green-600/50 text-green-500',
    dot: 'bg-green-500'
  },
  revision_pending: {
    border: 'border-blue-600/50',
    bg: 'bg-blue-600/5',
    text: 'text-blue-400',
    label: 'border-blue-600/50 text-blue-400',
    dot: 'bg-blue-400'
  }
};

export const SYLLABUS_DATA = {
  11: {
    Physics: [
      'Units & Measurements', 'Motion in a Straight Line', 'Motion in a Plane',
      'Laws of Motion', 'Work, Energy & Power', 'System of Particles & Rotational Motion',
      'Gravitation', 'Mechanical Properties of Solids', 'Mechanical Properties of Fluids',
      'Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory',
      'Oscillations', 'Waves'
    ],
    Chemistry: [
      'Some Basic Concepts of Chemistry', 'Structure of Atom', 'Classification of Elements & Periodicity',
      'Chemical Bonding & Molecular Structure', 'Thermodynamics', 'Equilibrium',
      'Redox Reactions', 'Organic Chemistry: Basic Principles & Techniques', 'Hydrocarbons'
    ],
    Maths: [
      'Sets', 'Relations & Functions', 'Trigonometric Functions', 'Complex Numbers & Quadratic Equations',
      'Linear Inequalities', 'Permutations & Combinations', 'Binomial Theorem', 'Sequences & Series',
      'Straight Lines', 'Conic Sections', 'Introduction to 3D Geometry', 'Limits & Derivatives',
      'Statistics', 'Probability'
    ]
  },
  12: {
    Physics: [
      'Electric Charges & Fields', 'Electrostatic Potential & Capacitance', 'Current Electricity',
      'Moving Charges & Magnetism', 'Magnetism & Matter', 'Electromagnetic Induction',
      'Alternating Current', 'Electromagnetic Waves', 'Ray Optics & Optical Instruments',
      'Wave Optics', 'Dual Nature of Radiation & Matter', 'Atoms', 'Nuclei',
      'Semiconductor Electronics'
    ],
    Chemistry: [
      'Solutions', 'Electrochemistry', 'Chemical Kinetics', 'd- & f-Block Elements',
      'Coordination Compounds', 'Haloalkanes & Haloarenes', 'Alcohols, Phenols & Ethers',
      'Aldehydes, Ketones & Carboxylic Acids', 'Amines', 'Biomolecules'
    ],
    Maths: [
      'Relations & Functions', 'Inverse Trigonometric Functions', 'Matrices',
      'Determinants', 'Continuity & Differentiability', 'Applications of Derivatives',
      'Integrals', 'Applications of Integrals', 'Differential Equations', 'Vector Algebra',
      'Three Dimensional Geometry', 'Linear Programming', 'Probability'
    ]
  }
};
