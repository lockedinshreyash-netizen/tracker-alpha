
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

export const STATUS_COLORS: Record<SyllabusStatus, { border: string, bg: string, text: string, label: string }> = {
  not_started: {
    border: 'border-zinc-800',
    bg: 'bg-transparent',
    text: 'text-zinc-500',
    label: 'border-zinc-800 text-zinc-600'
  },
  in_progress: {
    border: 'border-yellow-600',
    bg: 'bg-yellow-600/10',
    text: 'text-yellow-500',
    label: 'border-yellow-600/50 text-yellow-600'
  },
  completed: {
    border: 'border-green-600',
    bg: 'bg-green-600/10',
    text: 'text-green-500',
    label: 'border-green-600/50 text-green-500'
  },
  revision_pending: {
    border: 'border-blue-600',
    bg: 'bg-blue-600/10',
    text: 'text-blue-400',
    label: 'border-blue-600/50 text-blue-400'
  }
};

export const SYLLABUS_DATA = {
  11: {
    Physics: [
      'Physical world & measurement', 'Units & dimensions', 'Motion in a straight line',
      'Motion in a plane', 'Laws of motion', 'Work, energy & power',
      'Centre of mass & rotational motion', 'Gravitation', 'Mechanical properties of solids',
      'Mechanical properties of fluids', 'Thermal properties of matter', 'Thermodynamics',
      'Kinetic theory', 'Oscillations & waves'
    ],
    Chemistry: [
      'Some basic concepts of chemistry', 'Structure of atom', 'States of matter',
      'Thermodynamics', 'Equilibrium', 'Classification of elements & periodicity',
      'Chemical bonding & molecular structure', 'Basic organic chemistry (GOC)', 'Hydrocarbons'
    ],
    Maths: [
      'Sets', 'Relations & functions', 'Trigonometric functions', 'Complex numbers & quadratic equations',
      'Linear inequalities', 'Permutations & combinations', 'Binomial theorem', 'Sequences & series',
      'Straight lines', 'Conic sections', 'Introduction to 3D geometry', 'Limits & derivatives',
      'Mathematical reasoning', 'Statistics & probability'
    ]
  },
  12: {
    Physics: [
      'Electrostatics', 'Current electricity', 'Magnetic effects of current',
      'Electromagnetic induction', 'Alternating current', 'Electromagnetic waves',
      'Ray optics', 'Wave optics', 'Dual nature of radiation & matter', 'Atoms',
      'Nuclei', 'Semiconductor electronics'
    ],
    Chemistry: [
      'Solid state', 'Solutions', 'Electrochemistry', 'Chemical kinetics',
      'Surface chemistry', 'General principles of metallurgy', 'p-Block elements',
      'd- & f-Block elements', 'Coordination compounds', 'Haloalkanes & haloarenes',
      'Alcohols, phenols & ethers', 'Aldehydes, ketones & carboxylic acids', 'Amines',
      'Biomolecules', 'Polymers', 'Chemistry in everyday life'
    ],
    Maths: [
      'Relations & functions', 'Inverse trigonometric functions', 'Matrices',
      'Determinants', 'Continuity & differentiability', 'Applications of derivatives',
      'Integrals', 'Applications of integrals', 'Differential equations', 'Vector algebra',
      '3D geometry', 'Linear programming', 'Probability'
    ]
  }
};
