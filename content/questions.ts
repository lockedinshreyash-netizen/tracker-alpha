/**
 * Chapter mastery tests — exactly one question per topic.
 *
 * The rule the whole feature rests on: a test only exists for a chapter when
 * EVERY one of its topics has a question. A partial test would certify a
 * chapter on incomplete evidence, which is worse than offering no test at all.
 * `hasCompleteTest` enforces this and the UI hides the test otherwise.
 *
 * Because one question maps to one topic, a wrong answer names the exact topic
 * to revisit rather than producing an uninterpretable score.
 *
 * PILOT: 4 chapters fully covered — one per subject, spanning both exams.
 * Authoring more means writing every question for a chapter, not most of them.
 *
 * Correctness matters more here than anywhere else in the content layer. A
 * wrong key tells a student they have a gap they do not have, or worse,
 * certifies one they do.
 */

import { Topic, topicsForChapter } from './topics';

export interface TopicQuestion {
  /** Must match a Topic.id exactly. */
  topicId: string;
  question: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  /** Shown after answering, right or wrong. */
  explain: string;
}

export const QUESTIONS: TopicQuestion[] = [
  // ------------------------------------------- Physics 12 · Current Electricity
  {
    topicId: 'p12-current-electricity-drift-velocity-and-the-origin-of-ohm-s-l',
    question: 'A copper wire carries a steady current I. If its radius is doubled while the current is unchanged, the drift velocity becomes',
    options: ['4v', '2v', 'v/2', 'v/4'],
    answer: 3,
    explain: 'I = nAev_d. Area goes as r², so doubling the radius quadruples A, and v_d must fall to a quarter to keep I fixed.',
  },
  {
    topicId: 'p12-current-electricity-resistivity-its-temperature-dependence-a',
    question: 'On heating a semiconductor, its resistance',
    options: ['increases; α is positive', 'decreases; α is negative', 'stays constant', 'increases then decreases'],
    answer: 1,
    explain: 'Heating frees more charge carriers in a semiconductor, so n rises and resistivity falls. Metals do the opposite.',
  },
  {
    topicId: 'p12-current-electricity-combining-resistances-in-symmetric-netwo',
    question: 'Twelve identical resistors of resistance R form the edges of a cube. The resistance across a body diagonal is',
    options: ['5R/6', '3R/4', '7R/12', 'R/2'],
    answer: 0,
    explain: 'By symmetry the cube splits into 3 ∥ 6 ∥ 3 edge groups: R/3 + R/6 + R/3 = 5R/6.',
  },
  {
    topicId: 'p12-current-electricity-emf-internal-resistance-and-terminal-pot',
    question: 'A cell of emf ε and internal resistance r is being charged by an external source, drawing current I. Its terminal potential difference is',
    options: ['ε − Ir', 'ε + Ir', 'ε', 'Ir − ε'],
    answer: 1,
    explain: 'While charging, current is driven into the cell, so the Ir drop adds instead of subtracting. Terminal PD exceeds the emf.',
  },
  {
    topicId: 'p12-current-electricity-kirchhoff-s-rules-on-two-loop-circuits',
    question: 'Kirchhoff’s loop rule and junction rule express conservation of, respectively,',
    options: ['charge and energy', 'energy and charge', 'energy and momentum', 'charge and flux'],
    answer: 1,
    explain: 'Going round a loop returns you to the same potential — energy. Current in equals current out at a node — charge.',
  },
  {
    topicId: 'p12-current-electricity-wheatstone-bridge-and-the-meter-bridge-b',
    question: 'In a meter bridge the null point is 40 cm from the left end, with R in the left gap and S in the right. If R and S are interchanged, the null point moves to',
    options: ['40 cm', '50 cm', '60 cm', '30 cm'],
    answer: 2,
    explain: 'R/S = 40/60. Swapping inverts the ratio, so the balance length becomes 100 − 40 = 60 cm.',
  },
  {
    topicId: 'p12-current-electricity-potentiometer-comparing-emfs-and-finding',
    question: 'A potentiometer measures the true emf of a cell where a voltmeter cannot, because',
    options: [
      'it has a very high internal resistance',
      'it draws no current from the cell at the null point',
      'it is unaffected by temperature',
      'it needs no standard cell',
    ],
    answer: 1,
    explain: 'At null there is zero current through the cell, so no internal-resistance drop occurs and the reading is the emf itself.',
  },

  // ================================================================= CLASS 11 PHYSICS
  // ------------------------------- Physics 11 · System of Particles & Rotational Motion
  {
    topicId: 'p11-system-of-particles-rotational-motion-centre-of-mass-of-discrete-and-continuou',
    question: 'Two particles of masses m and 3m are placed 4 m apart. Their centre of mass lies',
    options: ['1 m from the lighter mass', '3 m from the lighter mass', '2 m from either mass', '1 m from the heavier mass'],
    answer: 1,
    explain: 'Taking the lighter mass as origin, x_cm = (m·0 + 3m·4)/(4m) = 3 m. The centre of mass always sits closer to the heavier body.',
  },
  {
    topicId: 'p11-system-of-particles-rotational-motion-moment-of-inertia-of-standard-bodies',
    question: 'The moment of inertia of a uniform rod of mass M and length L about an axis through one end, perpendicular to the rod, is',
    options: ['ML²/12', 'ML²/3', 'ML²/2', 'ML²'],
    answer: 1,
    explain: 'About the centre it is ML²/12; the parallel axis theorem adds M(L/2)² = ML²/4, giving ML²/3.',
  },
  {
    topicId: 'p11-system-of-particles-rotational-motion-parallel-and-perpendicular-axis-theorems',
    question: 'The perpendicular axis theorem I_z = I_x + I_y may be applied to',
    options: ['any rigid body', 'planar laminae only', 'spheres and cylinders only', 'hollow bodies only'],
    answer: 1,
    explain: 'It is derived assuming all mass lies in one plane, so it holds for laminae alone. The parallel axis theorem, by contrast, works for any body.',
  },
  {
    topicId: 'p11-system-of-particles-rotational-motion-torque-angular-momentum-and-the-conditio',
    question: 'The angular momentum of a system is conserved when',
    options: [
      'no external force acts',
      'no net external torque acts',
      'its kinetic energy is constant',
      'it moves with constant speed',
    ],
    answer: 1,
    explain: 'dL/dt = τ_ext, so zero net external torque means constant L. A net external force can still exist provided its torque about the chosen axis vanishes.',
  },
  {
    topicId: 'p11-system-of-particles-rotational-motion-rolling-without-slipping-deriving-a-g-si',
    question: 'A body rolls without slipping down an incline of angle θ. Its acceleration is',
    options: ['g sin θ', 'g sin θ / (1 + I/mR²)', 'g sin θ × (1 + I/mR²)', 'g cos θ / (1 + I/mR²)'],
    answer: 1,
    explain: 'Part of the released energy goes into rotation, so the body accelerates more slowly than a sliding one. a = g sin θ is only the frictionless sliding case.',
  },
  {
    topicId: 'p11-system-of-particles-rotational-motion-rolling-problems-acceleration-friction-a',
    question: 'A solid sphere, a disc and a ring of identical mass and radius roll without slipping from rest down the same incline. The order of arrival at the bottom is',
    options: [
      'ring, disc, sphere',
      'sphere, disc, ring',
      'all arrive together',
      'depends on their masses',
    ],
    answer: 1,
    explain: 'a = g sin θ/(1 + I/mR²), and I/mR² is 2/5 for a sphere, 1/2 for a disc and 1 for a ring. Smaller ratio means larger acceleration. Mass and radius cancel out entirely.',
  },
  {
    topicId: 'p11-system-of-particles-rotational-motion-angular-momentum-conservation-in-changin',
    question: 'A skater spinning on frictionless ice pulls her arms inwards. Her angular velocity and kinetic energy respectively',
    options: [
      'increase and stay constant',
      'increase and increase',
      'decrease and decrease',
      'stay constant and increase',
    ],
    answer: 1,
    explain: 'L = Iω is conserved, so reducing I raises ω. Since KE = L²/2I, the kinetic energy rises too — the extra energy comes from the muscular work of pulling the arms in.',
  },

  // ------------------------------------------------- Physics 11 · Gravitation
  {
    topicId: 'p11-gravitation-newton-s-law-of-gravitation-and-superpos',
    question: 'If the distance between two point masses is halved, the gravitational force between them becomes',
    options: ['half', 'double', 'four times', 'one quarter'],
    answer: 2,
    explain: 'F ∝ 1/r², so halving r multiplies the force by four. Gravitation is always attractive and independent of the medium between the masses.',
  },
  {
    topicId: 'p11-gravitation-variation-of-g-with-height-depth-and-lat',
    question: 'The value of g at the centre of the Earth is',
    options: ['maximum', 'zero', 'the same as at the surface', 'infinite'],
    answer: 1,
    explain: 'Inside a uniform Earth g varies as g(1 − d/R), so it falls linearly to zero at the centre. Above the surface it falls off as 1/r² instead.',
  },
  {
    topicId: 'p11-gravitation-gravitational-potential-and-potential-en',
    question: 'The gravitational potential energy of a two-mass system is',
    options: ['+GMm/r', '−GMm/r', '−GMm/r²', 'zero at r = 0'],
    answer: 1,
    explain: 'U = −GMm/r, taking zero at infinite separation. The negative sign reflects the fact that the force is attractive, so work must be done to separate the masses.',
  },
  {
    topicId: 'p11-gravitation-escape-velocity-and-orbital-velocity',
    question: 'The escape velocity from a planet’s surface relates to the orbital velocity of a satellite skimming that surface by',
    options: ['v_esc = v_orb', 'v_esc = √2 · v_orb', 'v_esc = 2 · v_orb', 'v_esc = v_orb/√2'],
    answer: 1,
    explain: 'v_orb = √(GM/R) and v_esc = √(2GM/R), so the escape speed is √2 times the orbital speed. Escape velocity does not depend on the escaping body’s mass or launch direction.',
  },
  {
    topicId: 'p11-gravitation-kepler-s-laws-and-satellite-motion',
    question: 'Kepler’s second law, that a planet sweeps equal areas in equal times, is a direct statement of',
    options: [
      'conservation of energy',
      'conservation of angular momentum',
      'conservation of linear momentum',
      'the inverse square law',
    ],
    answer: 1,
    explain: 'Gravity is a central force, so it exerts no torque about the Sun and L stays constant. Areal velocity equals L/2m, hence equal areas in equal times.',
  },

  // --------------------------------------------- Physics 11 · Units & Measurements
  {
    topicId: 'p11-units-measurements-dimensional-analysis-and-checking-equati',
    question: 'Which pair of quantities has the same dimensions?',
    options: [
      'Work and power',
      'Work and torque',
      'Force and momentum',
      'Pressure and force',
    ],
    answer: 1,
    explain: 'Both work and torque are [ML²T⁻²]. They are physically quite different — one is a scalar, the other a vector — which is why matching dimensions never proves two quantities are the same.',
  },
  {
    topicId: 'p11-units-measurements-deriving-relations-by-the-dimensional-me',
    question: 'The main limitation of the dimensional method is that it',
    options: [
      'cannot check the correctness of an equation',
      'cannot determine dimensionless constants',
      'cannot be applied to mechanical quantities',
      'requires the SI system',
    ],
    answer: 1,
    explain: 'It fixes the powers of the variables but never a numerical factor such as 2π or ½. It also fails for relations involving sums, or trigonometric and exponential functions.',
  },
  {
    topicId: 'p11-units-measurements-significant-figures-and-rounding-rules',
    question: 'The number 0.002340 has how many significant figures?',
    options: ['3', '4', '6', '7'],
    answer: 1,
    explain: 'Leading zeros never count; the trailing zero after a decimal point does. So 2, 3, 4 and the final 0 give four significant figures.',
  },
  {
    topicId: 'p11-units-measurements-combination-of-errors-in-sums-products-a',
    question: 'A quantity is calculated as Z = A²B/C. The relative errors in A, B and C are 1%, 2% and 3%. The maximum relative error in Z is',
    options: ['6%', '7%', '5%', '11%'],
    answer: 1,
    explain: 'Relative errors add, weighted by the powers: 2(1%) + 2% + 3% = 7%. For sums and differences it is the ABSOLUTE errors that add instead.',
  },

  // ------------------------------------------------ Physics 11 · Oscillations
  {
    topicId: 'p11-oscillations-shm-displacement-velocity-and-accelerati',
    question: 'In simple harmonic motion, the acceleration of the particle is',
    options: [
      'constant throughout',
      'proportional to displacement and directed towards the mean position',
      'proportional to displacement and directed away from the mean position',
      'maximum at the mean position',
    ],
    answer: 1,
    explain: 'a = −ω²x. The minus sign is the whole definition of SHM — the restoring acceleration always points back to the mean position, and is zero there.',
  },
  {
    topicId: 'p11-oscillations-energy-in-simple-harmonic-motion',
    question: 'In SHM, the kinetic energy is maximum',
    options: [
      'at the extreme positions',
      'at the mean position',
      'midway between mean and extreme',
      'everywhere equally',
    ],
    answer: 1,
    explain: 'Speed peaks at the mean position, so KE is maximum and PE is zero there. At the extremes the reverse holds. Total energy ½mω²A² stays constant throughout.',
  },
  {
    topicId: 'p11-oscillations-simple-pendulum-and-spring-mass-systems',
    question: 'The time period of a simple pendulum taken to the Moon, where g is about one sixth of its value on Earth, will',
    options: ['decrease', 'increase by a factor of about 2.45', 'stay the same', 'become zero'],
    answer: 1,
    explain: 'T = 2π√(l/g), so T ∝ 1/√g. Dividing g by 6 multiplies T by √6 ≈ 2.45. The period is independent of the bob’s mass.',
  },
  {
    topicId: 'p11-oscillations-springs-in-series-and-parallel',
    question: 'Two identical springs of constant k are joined in parallel and support a mass m. The time period of oscillation is',
    options: ['2π√(m/k)', '2π√(m/2k)', '2π√(2m/k)', '2π√(m/4k)'],
    answer: 1,
    explain: 'In parallel the effective constant is 2k, so T = 2π√(m/2k). In series it would be k/2, giving a longer period — the opposite of resistors.',
  },
  {
    topicId: 'p11-oscillations-damped-and-forced-oscillations-resonance',
    question: 'Resonance in a forced oscillator occurs when',
    options: [
      'the damping is largest',
      'the driving frequency equals the natural frequency',
      'the amplitude is smallest',
      'the driving frequency is doubled',
    ],
    answer: 1,
    explain: 'Amplitude peaks when the driver matches the natural frequency. Heavier damping lowers and broadens that peak but does not remove it.',
  },

  // ---------------------------------------------- Physics 11 · Thermodynamics
  {
    topicId: 'p11-thermodynamics-zeroth-law-and-thermal-equilibrium',
    question: 'The zeroth law of thermodynamics establishes the concept of',
    options: ['internal energy', 'temperature', 'entropy', 'work'],
    answer: 1,
    explain: 'If A and B are each in thermal equilibrium with C, they are in equilibrium with each other — which is what allows temperature to be defined and thermometers to work.',
  },
  {
    topicId: 'p11-thermodynamics-first-law-internal-energy-and-work-done',
    question: 'A gas absorbs 200 J of heat and does 80 J of work on its surroundings. The change in its internal energy is',
    options: ['280 J', '120 J', '−120 J', '80 J'],
    answer: 1,
    explain: 'ΔU = Q − W = 200 − 80 = 120 J. Heat added is positive; work done BY the gas is positive and reduces the internal energy.',
  },
  {
    topicId: 'p11-thermodynamics-isothermal-adiabatic-isobaric-and-isocho',
    question: 'In an adiabatic process,',
    options: [
      'the temperature stays constant',
      'no heat is exchanged, so ΔU = −W',
      'no work is done',
      'the pressure stays constant',
    ],
    answer: 1,
    explain: 'Q = 0, so any work done comes straight out of internal energy and the gas cools on expanding. Isothermal means ΔU = 0 instead, with Q = W.',
  },
  {
    topicId: 'p11-thermodynamics-second-law-and-the-direction-of-natural-',
    question: 'The second law of thermodynamics rules out',
    options: [
      'converting work entirely into heat',
      'converting heat entirely into work in a cyclic process',
      'heat flowing from hot to cold',
      'any change in entropy',
    ],
    answer: 1,
    explain: 'A cyclic engine must reject some heat to a cold reservoir — no engine reaches 100% efficiency. The reverse, turning work fully into heat, happens easily through friction.',
  },
  {
    topicId: 'p11-thermodynamics-heat-engines-efficiency-and-the-carnot-c',
    question: 'A Carnot engine operates between 400 K and 300 K. Its efficiency is',
    options: ['25%', '33%', '75%', '133%'],
    answer: 0,
    explain: 'η = 1 − T_cold/T_hot = 1 − 300/400 = 0.25. Temperatures must be absolute, and no engine between the same two reservoirs can beat this.',
  },

  // ----------------------------------- Physics 11 · Mechanical Properties of Fluids
  {
    topicId: 'p11-mechanical-properties-of-fluids-pressure-in-fluids-and-pascal-s-law',
    question: 'Pressure applied to an enclosed incompressible fluid is transmitted',
    options: [
      'only downwards',
      'undiminished to every part of the fluid and the walls of the container',
      'only along the direction it was applied',
      'with diminishing strength as distance increases',
    ],
    answer: 1,
    explain: 'This is Pascal’s law, and it is what makes hydraulic lifts and brakes work. Pressure in a static fluid also depends only on depth, never on the shape of the vessel.',
  },
  {
    topicId: 'p11-mechanical-properties-of-fluids-buoyancy-and-archimedes-principle',
    question: 'A body floats with exactly one third of its volume submerged. The ratio of the body’s density to the liquid’s density is',
    options: ['3 : 1', '1 : 3', '2 : 3', '1 : 2'],
    answer: 1,
    explain: 'For floating, weight equals buoyant force: ρ_body·V·g = ρ_liquid·(V/3)·g, so ρ_body/ρ_liquid = 1/3.',
  },
  {
    topicId: 'p11-mechanical-properties-of-fluids-viscosity-stokes-law-and-terminal-veloci',
    question: 'A small sphere falling through a viscous liquid reaches terminal velocity when',
    options: [
      'the viscous drag alone balances its weight',
      'weight equals the sum of buoyant force and viscous drag',
      'the buoyant force alone balances its weight',
      'its acceleration equals g',
    ],
    answer: 1,
    explain: 'At terminal velocity the net force is zero, and three forces act: weight down, buoyancy and viscous drag up. By Stokes’ law the terminal velocity goes as the square of the radius.',
  },
  {
    topicId: 'p11-mechanical-properties-of-fluids-equation-of-continuity-and-bernoulli-s-p',
    question: 'According to Bernoulli’s principle, where the speed of a flowing fluid is higher, the pressure is',
    options: ['higher', 'lower', 'unchanged', 'zero'],
    answer: 1,
    explain: 'P + ½ρv² + ρgh stays constant along a streamline, so a rise in speed forces a drop in pressure. This lifts aeroplane wings and drives the venturimeter.',
  },
  {
    topicId: 'p11-mechanical-properties-of-fluids-surface-tension-excess-pressure-and-capi',
    question: 'The excess pressure inside a soap bubble of radius R and surface tension T is',
    options: ['2T/R', '4T/R', 'T/R', 'T/2R'],
    answer: 1,
    explain: 'A soap bubble has two surfaces, giving 4T/R. A liquid drop or an air bubble inside a liquid has only one surface, so 2T/R — this distinction is the standard trap.',
  },

  // ---------------------------------------------- Physics 11 · Motion in a Plane
  {
    topicId: 'p11-motion-in-a-plane-vectors-addition-resolution-and-products',
    question: 'Two vectors of equal magnitude A are inclined at 120° to each other. The magnitude of their resultant is',
    options: ['2A', 'A√2', 'A', 'zero'],
    answer: 2,
    explain: 'R = 2A cos(θ/2) = 2A cos 60° = A for equal vectors. At 0° the resultant is 2A and at 180° it is zero.',
  },
  {
    topicId: 'p11-motion-in-a-plane-projectile-motion',
    question: 'Two projectiles are launched with the same speed at 30° and 60°. They have',
    options: [
      'the same range and the same maximum height',
      'the same range but different maximum heights',
      'different ranges and different heights',
      'the same time of flight',
    ],
    answer: 1,
    explain: 'Range goes as sin 2θ, and sin 60° = sin 120°, so complementary angles share a range. Maximum height goes as sin²θ, so the steeper launch climbs much higher and stays up longer.',
  },
  {
    topicId: 'p11-motion-in-a-plane-relative-velocity-in-two-dimensions',
    question: 'Rain falls vertically downwards. A man walking east should hold his umbrella',
    options: [
      'vertically',
      'tilted towards the east, the direction he is walking',
      'tilted towards the west',
      'horizontally',
    ],
    answer: 1,
    explain: 'In his frame the rain has a westward horizontal component equal and opposite to his own velocity, so it appears to come from ahead. He tilts forward, into his direction of motion.',
  },
  {
    topicId: 'p11-motion-in-a-plane-uniform-circular-motion',
    question: 'In uniform circular motion, the acceleration of the particle is',
    options: [
      'zero, since the speed is constant',
      'constant in magnitude, always directed towards the centre',
      'directed along the velocity',
      'constant in both magnitude and direction',
    ],
    answer: 1,
    explain: 'Speed is constant but the direction of velocity changes continuously, so there is a centripetal acceleration v²/r. Its magnitude is fixed while its direction turns with the particle.',
  },

  // ------------------------------------------------ Physics 11 · Kinetic Theory
  {
    topicId: 'p11-kinetic-theory-assumptions-of-kinetic-theory-and-the-pr',
    question: 'Kinetic theory gives the pressure of an ideal gas as',
    options: ['(1/3)ρv²_rms', '(2/3)ρv²_rms', 'ρv²_rms', '(1/2)ρv²_rms'],
    answer: 0,
    explain: 'P = (1/3)ρv²_rms, from averaging molecular momentum transfer over the three directions. The theory assumes point molecules, no intermolecular forces and perfectly elastic collisions.',
  },
  {
    topicId: 'p11-kinetic-theory-kinetic-interpretation-of-temperature-an',
    question: 'The rms speed of the molecules of a gas is doubled when its absolute temperature is',
    options: ['doubled', 'quadrupled', 'halved', 'left unchanged'],
    answer: 1,
    explain: 'v_rms = √(3RT/M) ∝ √T, so doubling the speed needs four times the absolute temperature. Note it must be measured in kelvin.',
  },
  {
    topicId: 'p11-kinetic-theory-degrees-of-freedom-and-equipartition-of-',
    question: 'At ordinary temperatures, a diatomic gas molecule has how many degrees of freedom?',
    options: ['3', '5', '6', '7'],
    answer: 1,
    explain: 'Three translational plus two rotational. The vibrational modes stay frozen out until much higher temperatures, when the count rises to 7.',
  },
  {
    topicId: 'p11-kinetic-theory-specific-heats-of-gases-and-mean-free-pa',
    question: 'The ratio γ = C_p/C_v for a monatomic ideal gas is',
    options: ['1.33', '1.40', '1.67', '1.00'],
    answer: 2,
    explain: 'γ = 1 + 2/f, and f = 3 for a monatomic gas, giving 5/3 ≈ 1.67. A diatomic gas has f = 5 and γ = 1.40.',
  },

  // ---------------------------------------- Physics 11 · Motion in a Straight Line
  {
    topicId: 'p11-motion-in-a-straight-line-distance-and-displacement-speed-and-velo',
    question: 'A runner completes exactly one lap of a circular track. Over that lap,',
    options: [
      'both distance and displacement are zero',
      'distance equals the circumference and displacement is zero',
      'both equal the circumference',
      'displacement equals the circumference and distance is zero',
    ],
    answer: 1,
    explain: 'Displacement depends only on start and end points, which coincide. Distance is the path length. So average velocity is zero while average speed is not.',
  },
  {
    topicId: 'p11-motion-in-a-straight-line-equations-of-uniformly-accelerated-motio',
    question: 'A body starts from rest and accelerates uniformly. The ratio of distances covered in the first, second and third seconds is',
    options: ['1 : 2 : 3', '1 : 3 : 5', '1 : 4 : 9', '1 : 1 : 1'],
    answer: 1,
    explain: 'Distance in the nth second is u + a(2n − 1)/2, which for u = 0 gives the odd-number ratio 1 : 3 : 5. Total distances from rest go as 1 : 4 : 9 instead.',
  },
  {
    topicId: 'p11-motion-in-a-straight-line-reading-position-velocity-and-accelerati',
    question: 'On a velocity–time graph, the area between the curve and the time axis represents',
    options: ['acceleration', 'displacement', 'average speed', 'jerk'],
    answer: 1,
    explain: 'Area under v–t gives displacement, while its slope gives acceleration. Area under an a–t graph gives the change in velocity.',
  },
  {
    topicId: 'p11-motion-in-a-straight-line-relative-velocity-in-one-dimension',
    question: 'Two cars travel along the same road at 60 km/h and 40 km/h in opposite directions. Their relative speed is',
    options: ['20 km/h', '100 km/h', '50 km/h', '2400 km/h'],
    answer: 1,
    explain: 'Relative velocity is v_A − v_B, and opposite directions carry opposite signs, so the magnitudes add: 60 + 40 = 100 km/h. Same direction would give 20 km/h.',
  },

  // --------------------------------------------- Physics 11 · Work, Energy & Power
  {
    topicId: 'p11-work-energy-power-work-done-by-constant-and-variable-force',
    question: 'A porter carries a suitcase horizontally at constant speed across a platform. The work done by the porter against gravity is',
    options: ['positive and large', 'zero', 'negative', 'equal to mgh'],
    answer: 1,
    explain: 'W = F·s·cos θ, and the upward supporting force is perpendicular to the horizontal displacement, so cos 90° = 0. No work is done against gravity.',
  },
  {
    topicId: 'p11-work-energy-power-work-energy-theorem',
    question: 'The work–energy theorem states that the net work done on a body equals its change in',
    options: ['momentum', 'kinetic energy', 'potential energy', 'total mechanical energy'],
    answer: 1,
    explain: 'W_net = ΔKE, and it holds whether the forces are conservative or not — friction included. That generality is what makes it so useful.',
  },
  {
    topicId: 'p11-work-energy-power-conservative-forces-and-potential-energy',
    question: 'A force is conservative if the work it does',
    options: [
      'is always positive',
      'is independent of the path and zero around a closed loop',
      'is always zero',
      'depends on the speed of the body',
    ],
    answer: 1,
    explain: 'Gravity and spring forces qualify, and a potential energy can be defined for them. Friction fails the test — it always drains energy, whatever the route.',
  },
  {
    topicId: 'p11-work-energy-power-conservation-of-mechanical-energy',
    question: 'A ball is dropped from height h. Ignoring air resistance, its speed on reaching the ground is',
    options: ['√(gh)', '√(2gh)', '2gh', 'gh'],
    answer: 1,
    explain: 'mgh converts entirely to ½mv², giving v = √(2gh). The result is independent of the ball’s mass.',
  },
  {
    topicId: 'p11-work-energy-power-elastic-and-inelastic-collisions',
    question: 'In a perfectly inelastic collision between two bodies,',
    options: [
      'both momentum and kinetic energy are conserved',
      'momentum is conserved but kinetic energy is not',
      'kinetic energy is conserved but momentum is not',
      'neither is conserved',
    ],
    answer: 1,
    explain: 'Momentum is conserved in every collision without external forces. In an inelastic one the bodies stick together and some kinetic energy becomes heat and deformation; only an elastic collision conserves KE as well.',
  },

  // -------------------------------- Physics 11 · Mechanical Properties of Solids
  {
    topicId: 'p11-mechanical-properties-of-solids-stress-strain-and-hooke-s-law',
    question: 'Strain is',
    options: [
      'measured in newtons per square metre',
      'a dimensionless ratio',
      'measured in newtons',
      'measured in joules',
    ],
    answer: 1,
    explain: 'Strain is a ratio of two lengths (or volumes), so it has no units. Stress is force per unit area and carries the same units as pressure, N m⁻².',
  },
  {
    topicId: 'p11-mechanical-properties-of-solids-young-s-bulk-and-shear-moduli',
    question: 'Two wires of the same material and length, one of twice the diameter of the other, are stretched by equal forces. The ratio of their extensions (thin : thick) is',
    options: ['1 : 2', '2 : 1', '4 : 1', '1 : 4'],
    answer: 2,
    explain: 'ΔL = FL/AY, so extension is inversely proportional to area, and area goes as the square of the diameter. The thin wire stretches four times as much.',
  },
  {
    topicId: 'p11-mechanical-properties-of-solids-the-stress-strain-curve-elastic-limit-an',
    question: 'The elastic limit on a stress–strain curve is the point beyond which',
    options: [
      'the material breaks immediately',
      'the material no longer returns to its original length when unloaded',
      'stress becomes zero',
      'strain becomes zero',
    ],
    answer: 1,
    explain: 'Past this point permanent deformation sets in. Hooke’s law only applies up to the proportional limit, which lies at or just below the elastic limit; fracture comes considerably later.',
  },
  {
    topicId: 'p11-mechanical-properties-of-solids-elastic-potential-energy-stored-in-a-str',
    question: 'The elastic potential energy stored per unit volume in a stretched wire is',
    options: ['stress × strain', '½ × stress × strain', 'stress / strain', '2 × stress × strain'],
    answer: 1,
    explain: 'Energy density is the area under the stress–strain line, so ½ × stress × strain. In terms of the wire as a whole, U = ½ F ΔL.',
  },

  // --------------------------------- Physics 11 · Thermal Properties of Matter
  {
    topicId: 'p11-thermal-properties-of-matter-thermal-expansion-of-solids-liquids-and-',
    question: 'A metal plate with a circular hole is heated uniformly. The diameter of the hole',
    options: ['decreases', 'increases', 'stays the same', 'first increases then decreases'],
    answer: 1,
    explain: 'The hole expands exactly as if it were filled with the same metal — every linear dimension scales up by the same factor. This is why heating a lid loosens it.',
  },
  {
    topicId: 'p11-thermal-properties-of-matter-specific-heat-capacity-and-calorimetry',
    question: 'Water has an unusually high specific heat capacity, which means that for a given heat input it',
    options: [
      'heats up faster than most substances',
      'changes temperature more slowly than most substances',
      'reaches a higher final temperature',
      'requires no heat to warm',
    ],
    answer: 1,
    explain: 'Q = mcΔT, so a large c gives a small ΔT for the same Q. This is why water is used as a coolant and why coastal climates are moderate.',
  },
  {
    topicId: 'p11-thermal-properties-of-matter-latent-heat-and-change-of-state',
    question: 'While a substance is melting at its melting point, the heat supplied',
    options: [
      'raises its temperature steadily',
      'changes its state at constant temperature',
      'is entirely lost to the surroundings',
      'lowers its temperature',
    ],
    answer: 1,
    explain: 'Latent heat goes into breaking intermolecular bonds, not into kinetic energy, so the temperature holds steady until the change of state is complete.',
  },
  {
    topicId: 'p11-thermal-properties-of-matter-conduction-convection-and-radiation',
    question: 'Heat transfer that requires no material medium is',
    options: ['conduction', 'convection', 'radiation', 'all three'],
    answer: 2,
    explain: 'Radiation travels as electromagnetic waves and crosses vacuum, which is how the Sun heats the Earth. Conduction and convection both need matter.',
  },
  {
    topicId: 'p11-thermal-properties-of-matter-newton-s-law-of-cooling-and-stefan-s-law',
    question: 'By Stefan’s law, if the absolute temperature of a black body is doubled, the energy it radiates per second becomes',
    options: ['2 times', '4 times', '8 times', '16 times'],
    answer: 3,
    explain: 'E ∝ T⁴, so doubling T multiplies the radiated power by 2⁴ = 16. Newton’s law of cooling is the small-temperature-difference approximation to this.',
  },

  // ------------------------------------------------- Physics 11 · Laws of Motion
  {
    topicId: 'p11-laws-of-motion-newton-s-three-laws-and-free-body-diagra',
    question: 'A book rests on a table. The reaction to the book’s weight, in the Newton’s-third-law sense, is',
    options: [
      'the normal force of the table on the book',
      'the gravitational pull of the book on the Earth',
      'the weight of the table',
      'the friction between book and table',
    ],
    answer: 1,
    explain: 'Third-law pairs act on DIFFERENT bodies and are the same kind of force. The book’s weight is Earth pulling book, so its partner is book pulling Earth. The normal force balances the weight but is a separate interaction.',
  },
  {
    topicId: 'p11-laws-of-motion-momentum-and-impulse',
    question: 'A cricketer draws his hands back while catching a fast ball in order to',
    options: [
      'reduce the change in momentum',
      'increase the time of impact and so reduce the force',
      'increase the impulse delivered',
      'reduce the ball’s kinetic energy',
    ],
    answer: 1,
    explain: 'The impulse — the total change in momentum — is fixed by the ball’s speed. Stretching the collision time out means F = Δp/Δt gives a smaller peak force.',
  },
  {
    topicId: 'p11-laws-of-motion-friction-static-kinetic-and-rolling',
    question: 'For most surfaces, the limiting static friction compared with the kinetic friction is',
    options: ['smaller', 'greater', 'exactly equal', 'zero'],
    answer: 1,
    explain: 'μ_s > μ_k, which is why a stationary object takes more force to start moving than to keep moving. Rolling friction is smaller again.',
  },
  {
    topicId: 'p11-laws-of-motion-circular-motion-dynamics-and-banking-of-',
    question: 'For a car turning on a frictionless banked road of angle θ and radius r, the safe speed satisfies',
    options: ['v² = rg tan θ', 'v² = rg sin θ', 'v² = rg cos θ', 'v² = rg / tan θ'],
    answer: 0,
    explain: 'The horizontal component of the normal force supplies the centripetal force, giving tan θ = v²/rg. Banking lets the turn be taken without relying on friction at all.',
  },
  {
    topicId: 'p11-laws-of-motion-pulleys-and-connected-body-problems',
    question: 'Two masses m₁ and m₂ (m₁ > m₂) hang from a light inextensible string over a frictionless pulley. The acceleration of the system is',
    options: [
      '(m₁ − m₂)g / (m₁ + m₂)',
      '(m₁ + m₂)g / (m₁ − m₂)',
      '(m₁ − m₂)g / (m₁ m₂)',
      'g',
    ],
    answer: 0,
    explain: 'The net driving force is (m₁ − m₂)g acting on the total mass (m₁ + m₂). Tension is the same throughout a light string over a frictionless pulley.',
  },

  // ------------------------------------------------------- Physics 11 · Waves
  {
    topicId: 'p11-waves-transverse-and-longitudinal-waves-and-th',
    question: 'Sound waves travelling through air are',
    options: [
      'transverse',
      'longitudinal',
      'electromagnetic',
      'both transverse and longitudinal',
    ],
    answer: 1,
    explain: 'Gases have no shear rigidity, so they cannot carry transverse mechanical waves. Sound propagates as compressions and rarefactions along the direction of travel.',
  },
  {
    topicId: 'p11-waves-speed-of-a-wave-on-a-string-and-in-a-gas',
    question: 'The speed of a transverse wave on a stretched string is given by',
    options: ['√(μ/T)', '√(T/μ)', 'T/μ', 'Tμ'],
    answer: 1,
    explain: 'v = √(T/μ) with T the tension and μ the mass per unit length. Tightening the string raises the speed; a heavier string lowers it.',
  },
  {
    topicId: 'p11-waves-superposition-standing-waves-and-normal-',
    question: 'In a pipe closed at one end, the harmonics present are',
    options: [
      'all harmonics',
      'only odd harmonics',
      'only even harmonics',
      'only the fundamental',
    ],
    answer: 1,
    explain: 'A closed end forces a node and the open end an antinode, which admits only odd multiples of the fundamental. An open pipe supports all harmonics and sounds richer.',
  },
  {
    topicId: 'p11-waves-beats',
    question: 'Two tuning forks of frequencies 256 Hz and 260 Hz are sounded together. The number of beats heard per second is',
    options: ['2', '4', '8', '516'],
    answer: 1,
    explain: 'Beat frequency is the difference of the two frequencies, 260 − 256 = 4 Hz. Beats become hard to hear once the difference exceeds about 10 Hz.',
  },
  {
    topicId: 'p11-waves-the-doppler-effect',
    question: 'A source of sound moves towards a stationary observer. The observer hears a frequency that is',
    options: [
      'higher, because the wavelength reaching them is compressed',
      'lower, because the wavelength is stretched',
      'unchanged, since the source frequency is fixed',
      'higher, because the speed of sound increases',
    ],
    answer: 0,
    explain: 'Approaching motion crowds the wavefronts, shortening the wavelength and raising the observed frequency. The speed of sound in the medium never changes.',
  },

  // ---------------------------------------- Physics 12 · Moving Charges & Magnetism
  {
    topicId: 'p12-moving-charges-magnetism-lorentz-force-on-a-moving-charge',
    question: 'A charged particle moves parallel to a uniform magnetic field. The magnetic force on it is',
    options: ['qvB', 'zero', 'qvB, directed along the field', 'qE'],
    answer: 1,
    explain: 'F = qvB sin θ, and θ = 0 for parallel motion, so the force vanishes. The force is also always perpendicular to v, which is why a magnetic field can never change a particle’s speed.',
  },
  {
    topicId: 'p12-moving-charges-magnetism-circular-motion-in-a-magnetic-field-and-',
    question: 'A charged particle moves in a circle in a uniform magnetic field. Its time period is',
    options: [
      'proportional to its speed',
      'independent of its speed',
      'inversely proportional to its speed',
      'proportional to the square of the radius',
    ],
    answer: 1,
    explain: 'r = mv/qB and T = 2πm/qB, so speed cancels out. A faster particle simply takes a bigger circle in the same time — the fact that makes the cyclotron work.',
  },
  {
    topicId: 'p12-moving-charges-magnetism-biot-savart-law-and-the-field-of-a-circu',
    question: 'The magnetic field at the centre of a circular loop of radius R carrying current I is',
    options: ['μ₀I/2R', 'μ₀I/4πR', 'μ₀I/2πR', 'μ₀I/R'],
    answer: 0,
    explain: 'Integrating Biot–Savart around the loop gives B = μ₀I/2R. The μ₀I/2πr form belongs to a straight infinite wire — do not swap them.',
  },
  {
    topicId: 'p12-moving-charges-magnetism-amp-re-s-circuital-law-solenoid-and-toro',
    question: 'The magnetic field well inside a long current-carrying solenoid is',
    options: [
      'zero everywhere',
      'uniform and equal to μ₀nI',
      'proportional to the distance from the axis',
      'greatest at the surface and zero on the axis',
    ],
    answer: 1,
    explain: 'Ampère’s law gives B = μ₀nI with n the turns per unit length — uniform, and independent of the solenoid’s radius. The field just outside a long solenoid is essentially zero.',
  },
  {
    topicId: 'p12-moving-charges-magnetism-force-between-parallel-currents-and-torq',
    question: 'Two long parallel wires carry currents in the same direction. They',
    options: ['attract each other', 'repel each other', 'exert no force', 'exert a torque but no force'],
    answer: 0,
    explain: 'Like currents attract, unlike currents repel — the opposite of the rule for charges. This force is what defines the ampere.',
  },

  // -------------------------------------------- Physics 12 · Electromagnetic Waves
  {
    topicId: 'p12-electromagnetic-waves-displacement-current-and-maxwell-s-corre',
    question: 'Maxwell introduced the displacement current in order to',
    options: [
      'explain conduction of current in metals',
      'make Ampère’s law consistent in the gap of a charging capacitor',
      'account for the photoelectric effect',
      'explain eddy currents in a conductor',
    ],
    answer: 1,
    explain: 'For a charging capacitor, Ampère’s law gave different answers for two surfaces sharing the same boundary. The term ε₀ dΦ_E/dt resolves it, and it is what predicts electromagnetic waves.',
  },
  {
    topicId: 'p12-electromagnetic-waves-nature-of-em-waves-e-b-and-the-direction',
    question: 'In a plane electromagnetic wave travelling through vacuum, the E and B fields are',
    options: [
      'parallel to each other',
      'mutually perpendicular, and both perpendicular to the direction of travel',
      'perpendicular to each other but along the direction of travel',
      'randomly oriented with respect to each other',
    ],
    answer: 1,
    explain: 'E, B and the propagation direction form a right-handed set along E × B. The two fields oscillate in phase, so both peak at the same instant. EM waves are transverse.',
  },
  {
    topicId: 'p12-electromagnetic-waves-speed-of-em-waves-and-the-e-b-ratio',
    question: 'For an electromagnetic wave in vacuum, the ratio of the electric field amplitude to the magnetic field amplitude, E₀/B₀, equals',
    options: ['1', 'c', '1/c', 'c²'],
    answer: 1,
    explain: 'E₀/B₀ = c ≈ 3 × 10⁸ m s⁻¹, which is why B is numerically tiny beside E in SI units. Also c = 1/√(μ₀ε₀).',
  },
  {
    topicId: 'p12-electromagnetic-waves-the-electromagnetic-spectrum-and-its-use',
    question: 'Which of the following has the shortest wavelength?',
    options: ['X-rays', 'Microwaves', 'Gamma rays', 'Ultraviolet'],
    answer: 2,
    explain: 'In order of increasing frequency: radio, microwave, infrared, visible, ultraviolet, X-ray, gamma. Gamma rays sit at the top, so they have the shortest wavelength.',
  },

  // ------------------------------------------------- Physics 12 · Wave Optics
  {
    topicId: 'p12-wave-optics-huygens-principle-and-wavefronts',
    question: 'According to Huygens’ principle, every point on a wavefront acts as a source of',
    options: ['plane waves', 'secondary spherical wavelets', 'longitudinal waves', 'particles'],
    answer: 1,
    explain: 'The new wavefront is the forward envelope of these secondary wavelets. The construction explains reflection, refraction and diffraction without any particle picture.',
  },
  {
    topicId: 'p12-wave-optics-young-s-double-slit-fringe-width-and-con',
    question: 'In a Young’s double slit experiment the slit separation d is doubled, everything else unchanged. The fringe width',
    options: ['doubles', 'halves', 'is unchanged', 'becomes four times larger'],
    answer: 1,
    explain: 'β = λD/d, so β is inversely proportional to d. Widening the slit separation crowds the fringes together.',
  },
  {
    topicId: 'p12-wave-optics-coherence-and-what-destroys-interference',
    question: 'A sustained interference pattern requires the two sources to be',
    options: [
      'of exactly equal intensity',
      'coherent, holding a constant phase difference',
      'monochromatic but otherwise unrelated',
      'separated by a large distance',
    ],
    answer: 1,
    explain: 'Without a constant phase relationship the pattern washes out faster than the eye can register. Two independent bulbs never interfere, which is why both slits are lit from one source.',
  },
  {
    topicId: 'p12-wave-optics-single-slit-diffraction',
    question: 'In single-slit diffraction, the central maximum is',
    options: [
      'the same width as the other maxima',
      'twice as wide as the other maxima',
      'half as wide as the other maxima',
      'infinitely wide',
    ],
    answer: 1,
    explain: 'The first minima sit at a sin θ = ±λ, so the central maximum spans 2λD/a while later maxima span λD/a. Narrowing the slit spreads the pattern out.',
  },
  {
    topicId: 'p12-wave-optics-polarisation-and-brewster-s-law',
    question: 'When unpolarised light strikes a surface at the Brewster angle, the reflected light is',
    options: ['unpolarised', 'completely plane polarised', 'circularly polarised', 'entirely absent'],
    answer: 1,
    explain: 'tan θ_p = n, and at this angle the reflected and refracted rays are perpendicular. The reflected beam is fully plane polarised perpendicular to the plane of incidence.',
  },

  // ------------------------------------------------------- Physics 12 · Atoms
  {
    topicId: 'p12-atoms-rutherford-scattering-and-where-his-mode',
    question: 'The scattering of a few alpha particles through very large angles showed that',
    options: [
      'positive charge is spread uniformly through the atom',
      'the positive charge and nearly all the mass sit in a tiny nucleus',
      'electrons occupy fixed circular orbits',
      'atoms cannot be divided further',
    ],
    answer: 1,
    explain: 'Most alphas passed nearly straight through, so the atom is mostly empty; the rare large deflections demanded a very small, dense, positive core. Rutherford’s model then failed to explain why orbiting electrons do not radiate and spiral inward.',
  },
  {
    topicId: 'p12-atoms-bohr-s-postulates-and-quantisation-of-an',
    question: 'In Bohr’s model, the angular momentum of an electron in the nth orbit is',
    options: ['nh', 'nh/2π', 'n²h/2π', 'h/2πn'],
    answer: 1,
    explain: 'mvr = nh/2π. This quantisation is precisely the condition that a whole number of de Broglie wavelengths fits around the orbit.',
  },
  {
    topicId: 'p12-atoms-radius-velocity-and-energy-in-bohr-orbit',
    question: 'The energy of the electron in the n = 2 state of a hydrogen atom is',
    options: ['−13.6 eV', '−3.4 eV', '−1.51 eV', '−0.85 eV'],
    answer: 1,
    explain: 'E_n = −13.6/n² eV, so E₂ = −13.6/4 = −3.4 eV. Radius goes as n² and speed as 1/n.',
  },
  {
    topicId: 'p12-atoms-hydrogen-spectral-series',
    question: 'Which series of the hydrogen spectrum lies in the visible region?',
    options: ['Lyman', 'Balmer', 'Paschen', 'Brackett'],
    answer: 1,
    explain: 'Balmer (transitions ending at n = 2) is visible. Lyman (n = 1) is ultraviolet; Paschen, Brackett and Pfund are all infrared.',
  },

  // -------------------------------------------- Physics 12 · Magnetism & Matter
  {
    topicId: 'p12-magnetism-matter-bar-magnet-dipole-moment-and-field-lines',
    question: 'Magnetic field lines of a bar magnet',
    options: [
      'begin at the north pole and end at the south pole, forming open curves',
      'form closed loops, running from S to N inside the magnet',
      'intersect one another at the poles',
      'exist only outside the magnet',
    ],
    answer: 1,
    explain: 'They are always closed loops because isolated magnetic poles do not exist — the consequence of ∮B·dA = 0. Break a magnet in two and you get two complete dipoles.',
  },
  {
    topicId: 'p12-magnetism-matter-earth-s-magnetism-declination-dip-and-ho',
    question: 'The angle of dip at the magnetic equator is',
    options: ['0°', '45°', '90°', '180°'],
    answer: 0,
    explain: 'At the magnetic equator the Earth’s field is horizontal, so a dip needle stays level and the dip is zero. At the magnetic poles it is 90°, pointing straight down.',
  },
  {
    topicId: 'p12-magnetism-matter-dia-para-and-ferromagnetism',
    question: 'A diamagnetic material placed in a magnetic field is',
    options: [
      'strongly attracted towards the stronger part of the field',
      'feebly repelled towards the weaker part of the field',
      'strongly repelled and retains its magnetism afterwards',
      'completely unaffected',
    ],
    answer: 1,
    explain: 'Diamagnets have no permanent moment; an induced moment opposes the applied field, giving weak repulsion. Paramagnets are weakly attracted, ferromagnets strongly so.',
  },
  {
    topicId: 'p12-magnetism-matter-magnetisation-susceptibility-and-permeab',
    question: 'For a paramagnetic material, the magnetic susceptibility is',
    options: ['small and negative', 'small and positive', 'large and negative', 'exactly zero'],
    answer: 1,
    explain: 'χ is small and positive for paramagnets and falls as 1/T by Curie’s law. Diamagnets have small negative χ; ferromagnets have very large positive χ.',
  },

  // ---------------------------------------- Physics 12 · Electric Charges & Fields
  {
    topicId: 'p12-electric-charges-fields-coulomb-s-law-and-superposition-of-force',
    question: 'Two point charges a fixed distance apart repel with force F in vacuum. If the space between them is filled with a medium of dielectric constant K, the force becomes',
    options: ['KF', 'F/K', 'F/K²', 'F, unchanged'],
    answer: 1,
    explain: 'Coulomb’s law carries 1/(4πε₀K) in a medium, so the force is reduced by exactly K. This is why a dielectric weakens electrostatic interaction.',
  },
  {
    topicId: 'p12-electric-charges-fields-electric-field-and-the-rules-field-lines',
    question: 'Two electric field lines can never intersect because',
    options: [
      'the field would be zero at that point',
      'the field would have two directions at one point, which is impossible',
      'field lines always repel one another',
      'it would violate Gauss’s law',
    ],
    answer: 1,
    explain: 'The tangent to a field line gives the direction of E at that point. A crossing would assign two directions to a single point. Field lines also start on positive and end on negative charge, and never form closed loops in electrostatics.',
  },
  {
    topicId: 'p12-electric-charges-fields-electric-dipole-field-and-torque-in-a-un',
    question: 'An electric dipole placed in a uniform electric field experiences',
    options: [
      'a net force and a net torque',
      'a net torque but no net force',
      'a net force but no torque',
      'neither a net force nor a torque',
    ],
    answer: 1,
    explain: 'Equal and opposite forces act on the two charges, so they cancel — but they act along different lines, giving τ = pE sin θ. A NON-uniform field would produce a net force as well.',
  },
  {
    topicId: 'p12-electric-charges-fields-electric-flux-and-gauss-s-law',
    question: 'The total electric flux through a closed surface depends on',
    options: [
      'the shape of the surface',
      'only the net charge enclosed by it',
      'where inside the surface the charges sit',
      'the charges lying outside the surface',
    ],
    answer: 1,
    explain: 'Φ = q_enclosed/ε₀. Shape, position of the internal charges and any external charges all affect the field at individual points, but not the total flux.',
  },
  {
    topicId: 'p12-electric-charges-fields-applying-gauss-s-law-to-a-wire-a-sheet-a',
    question: 'The electric field due to an infinite plane sheet of uniform surface charge density σ is',
    options: ['σ/ε₀', 'σ/2ε₀', 'σ/(2ε₀r)', 'zero'],
    answer: 1,
    explain: 'A cylindrical Gaussian pillbox pierces the sheet with two end faces, giving E = σ/2ε₀ — independent of distance. For an infinite wire the field goes as λ/(2πε₀r), and inside a uniform shell it is zero.',
  },

  // ------------------------------------------- Physics 12 · Alternating Current
  {
    topicId: 'p12-alternating-current-rms-and-average-values-of-ac',
    question: 'A sinusoidal alternating current has a peak value of 10 A. Its RMS value is about',
    options: ['5.0 A', '7.07 A', '10.0 A', '14.14 A'],
    answer: 1,
    explain: 'I_rms = I₀/√2 = 10/1.414 ≈ 7.07 A. The mean value over a full cycle is zero, which is why RMS is the useful measure.',
  },
  {
    topicId: 'p12-alternating-current-phase-relations-for-r-l-and-c-separately',
    question: 'In a purely inductive AC circuit, the current',
    options: [
      'leads the voltage by π/2',
      'lags the voltage by π/2',
      'is in phase with the voltage',
      'lags the voltage by π',
    ],
    answer: 1,
    explain: 'An inductor opposes change in current, so current lags voltage by a quarter cycle. A capacitor is the mirror image — current leads by π/2. In a resistor they are in phase.',
  },
  {
    topicId: 'p12-alternating-current-series-lcr-circuits-and-impedance',
    question: 'A series LCR circuit has R = 3 Ω, X_L = 8 Ω and X_C = 4 Ω. Its impedance is',
    options: ['5 Ω', '7 Ω', '11 Ω', '15 Ω'],
    answer: 0,
    explain: 'Z = √(R² + (X_L − X_C)²) = √(9 + 16) = 5 Ω. The reactances subtract because they are 180° out of phase with each other.',
  },
  {
    topicId: 'p12-alternating-current-resonance-and-quality-factor',
    question: 'At resonance in a series LCR circuit,',
    options: [
      'the impedance is maximum',
      'the impedance is minimum and equal to R',
      'the current is minimum',
      'the power factor is zero',
    ],
    answer: 1,
    explain: 'At ω₀ = 1/√(LC) the reactances cancel, leaving Z = R. Current peaks and the power factor is 1. A PARALLEL LCR circuit behaves oppositely, with maximum impedance at resonance.',
  },
  {
    topicId: 'p12-alternating-current-power-in-ac-circuits-and-the-power-facto',
    question: 'The average power consumed over a full cycle by an ideal capacitor in an AC circuit is',
    options: ['V_rms·I_rms', 'V_rms·I_rms/2', 'zero', 'V_rms·I_rms·√2'],
    answer: 2,
    explain: 'P = V_rms I_rms cos φ, and φ = 90° for a pure capacitor or inductor, so cos φ = 0. Energy is stored and returned each cycle — this is the wattless current.',
  },
  {
    topicId: 'p12-alternating-current-transformers',
    question: 'An ideal step-up transformer',
    options: [
      'increases both voltage and current',
      'increases voltage and decreases current',
      'decreases both voltage and current',
      'increases the power delivered',
    ],
    answer: 1,
    explain: 'An ideal transformer conserves power, so V_p I_p = V_s I_s. Raising voltage must lower current. It works on mutual induction and functions only on AC.',
  },

  // -------------------------------------- Physics 12 · Electromagnetic Induction
  {
    topicId: 'p12-electromagnetic-induction-magnetic-flux-and-faraday-s-law',
    question: 'The EMF induced in a coil is determined by',
    options: [
      'the magnetic flux through it',
      'the rate of change of magnetic flux through it',
      'the resistance of the coil',
      'the number of turns alone',
    ],
    answer: 1,
    explain: 'ε = −N dΦ/dt. A large steady flux induces nothing at all; only a CHANGING flux does. Resistance sets the induced current, not the EMF.',
  },
  {
    topicId: 'p12-electromagnetic-induction-lenz-s-law-as-energy-conservation',
    question: 'Lenz’s law is a direct consequence of the conservation of',
    options: ['charge', 'momentum', 'energy', 'mass'],
    answer: 2,
    explain: 'The induced effect always opposes the change producing it. If it aided the change instead, motion would amplify itself and generate energy from nothing.',
  },
  {
    topicId: 'p12-electromagnetic-induction-motional-emf',
    question: 'A rod of length 0.2 m moves at 10 m s⁻¹ perpendicular to a uniform magnetic field of 0.5 T. The EMF induced across its ends is',
    options: ['0.1 V', '1.0 V', '2.5 V', '10 V'],
    answer: 1,
    explain: 'ε = Bvl = 0.5 × 10 × 0.2 = 1.0 V. The three vectors must be mutually perpendicular for this simple form to apply.',
  },
  {
    topicId: 'p12-electromagnetic-induction-self-inductance-and-the-energy-stored-in',
    question: 'If the current through an inductor is doubled, the energy stored in it becomes',
    options: ['twice as large', 'four times as large', 'half as large', 'unchanged'],
    answer: 1,
    explain: 'U = ½LI², so energy goes as the square of the current. L itself depends only on the coil’s geometry and core, never on the current.',
  },
  {
    topicId: 'p12-electromagnetic-induction-mutual-inductance-between-two-coils',
    question: 'The mutual inductance of a pair of coils depends on',
    options: [
      'the current flowing in either coil',
      'their geometry, separation and relative orientation',
      'the resistance of the coils',
      'the EMF applied to the primary',
    ],
    answer: 1,
    explain: 'M is fixed by the arrangement alone, exactly as capacitance is fixed by geometry. It also obeys M₁₂ = M₂₁ whatever the coils look like.',
  },
  {
    topicId: 'p12-electromagnetic-induction-eddy-currents',
    question: 'Transformer cores are laminated rather than solid in order to',
    options: [
      'increase the magnetic flux',
      'reduce energy loss from eddy currents',
      'increase the self inductance',
      'reduce resistive loss in the windings',
    ],
    answer: 1,
    explain: 'Thin insulated laminations break up the closed paths eddy currents would otherwise take, cutting heat loss. Copper loss in the windings is a separate effect.',
  },

  // ------------------------------------------------------ Physics 12 · Nuclei
  {
    topicId: 'p12-nuclei-nuclear-size-density-and-composition',
    question: 'The density of nuclear matter',
    options: [
      'increases with mass number A',
      'decreases with mass number A',
      'is nearly the same for all nuclei',
      'is proportional to A²',
    ],
    answer: 2,
    explain: 'R = R₀A^(1/3), so volume goes as A while mass also goes as A. The ratio is constant at roughly 2.3 × 10¹⁷ kg m⁻³ for every nucleus.',
  },
  {
    topicId: 'p12-nuclei-mass-defect-and-binding-energy',
    question: 'The energy equivalent of one atomic mass unit is approximately',
    options: ['931.5 MeV', '93.15 MeV', '9315 MeV', '1.6 MeV'],
    answer: 0,
    explain: 'E = Δmc² with 1 u = 1.66 × 10⁻²⁷ kg gives 931.5 MeV. Binding energy is the mass defect converted through this factor.',
  },
  {
    topicId: 'p12-nuclei-the-binding-energy-per-nucleon-curve-fis',
    question: 'Both fission and fusion release energy because in each case the products have',
    options: [
      'lower binding energy per nucleon',
      'higher binding energy per nucleon',
      'a greater number of nucleons',
      'greater total mass',
    ],
    answer: 1,
    explain: 'The curve peaks near iron (A ≈ 56). Heavy nuclei climb towards it by splitting, light nuclei by fusing — either way the products are more tightly bound and the surplus mass appears as energy.',
  },
  {
    topicId: 'p12-nuclei-radioactive-decay-law-and-half-life',
    question: 'After three half-lives, the fraction of the original radioactive nuclei still undecayed is',
    options: ['1/3', '1/6', '1/8', '1/9'],
    answer: 2,
    explain: 'Each half-life halves the population: 1/2 → 1/4 → 1/8. Formally N = N₀(1/2)^(t/T), and T = ln2/λ.',
  },
  {
    topicId: 'p12-nuclei-alpha-beta-and-gamma-decay',
    question: 'In β⁻ decay, the atomic number of the nucleus',
    options: ['decreases by 1', 'increases by 1', 'is unchanged', 'decreases by 2'],
    answer: 1,
    explain: 'A neutron becomes a proton, an electron and an antineutrino, so Z rises by 1 while A stays the same. α decay drops A by 4 and Z by 2; γ emission changes neither.',
  },

  // --------------------------------- Physics 12 · Dual Nature of Radiation & Matter
  {
    topicId: 'p12-dual-nature-of-radiation-matter-photoelectric-effect-threshold-frequency',
    question: 'Photoelectric emission occurs only above a threshold frequency because',
    options: [
      'the intensity is always too low below it',
      'a single photon must carry at least the work function’s worth of energy',
      'electrons need time to accumulate enough energy',
      'the metal reflects all lower frequencies',
    ],
    answer: 1,
    explain: 'Emission is a one-photon, one-electron event. If hν < φ no single photon can free an electron, and piling on intensity only adds more photons that are each still too weak.',
  },
  {
    topicId: 'p12-dual-nature-of-radiation-matter-einstein-s-photoelectric-equation-and-st',
    question: 'Light of photon energy 5 eV falls on a metal of work function 2 eV. The maximum kinetic energy of the emitted photoelectrons is',
    options: ['2 eV', '3 eV', '5 eV', '7 eV'],
    answer: 1,
    explain: 'K_max = hν − φ = 5 − 2 = 3 eV, so the stopping potential is 3 V. Electrons from deeper in the metal emerge with less than this.',
  },
  {
    topicId: 'p12-dual-nature-of-radiation-matter-why-intensity-and-frequency-do-different',
    question: 'For light already above the threshold frequency, increasing only the intensity',
    options: [
      'raises the maximum kinetic energy of the photoelectrons',
      'raises the number of photoelectrons emitted per second',
      'lowers the stopping potential',
      'raises the threshold frequency of the metal',
    ],
    answer: 1,
    explain: 'Intensity sets how many photons arrive, so it controls photocurrent. Frequency sets the energy each photon carries, so it alone controls K_max and the stopping potential.',
  },
  {
    topicId: 'p12-dual-nature-of-radiation-matter-photon-energy-and-momentum',
    question: 'The momentum of a photon of wavelength λ is',
    options: ['h/λ', 'hλ', 'h/λ²', 'hc/λ'],
    answer: 0,
    explain: 'p = h/λ. The lookalike hc/λ is the photon’s ENERGY — mixing these two up is the most frequent slip in this chapter.',
  },
  {
    topicId: 'p12-dual-nature-of-radiation-matter-de-broglie-wavelength-of-matter-waves',
    question: 'An electron is accelerated from rest through a potential difference V. Its de Broglie wavelength is proportional to',
    options: ['V', '√V', '1/√V', '1/V'],
    answer: 2,
    explain: 'λ = h/p and p = √(2meV), so λ ∝ 1/√V. Numerically λ ≈ 12.27/√V ångström for an electron with V in volts.',
  },
  {
    topicId: 'p12-dual-nature-of-radiation-matter-davisson-germer-experiment',
    question: 'The Davisson–Germer experiment demonstrated',
    options: [
      'the particle nature of light',
      'the wave nature of electrons',
      'the existence of the nucleus',
      'the quantisation of electric charge',
    ],
    answer: 1,
    explain: 'Electrons scattered off a nickel crystal produced a diffraction maximum, confirming de Broglie’s matter waves. The photoelectric effect is the counterpart result for light behaving as particles.',
  },

  // ------------------------------------ Physics 12 · Ray Optics & Optical Instruments
  {
    topicId: 'p12-ray-optics-optical-instruments-sign-convention-and-applying-it-without-',
    question: 'Using the Cartesian sign convention, the focal lengths of a concave mirror and a convex lens are respectively',
    options: ['negative and positive', 'positive and negative', 'both negative', 'both positive'],
    answer: 0,
    explain: 'Distances are measured from the pole/optical centre, positive along the incident direction. A concave mirror’s focus lies on the incoming side, so f < 0; a convex lens converges light on the far side, so f > 0.',
  },
  {
    topicId: 'p12-ray-optics-optical-instruments-mirror-formula-and-magnification',
    question: 'An object is placed 30 cm in front of a concave mirror of focal length 20 cm. The image is formed at',
    options: ['60 cm in front of the mirror', '12 cm in front of the mirror', '60 cm behind the mirror', '20 cm in front of the mirror'],
    answer: 0,
    explain: '1/v + 1/u = 1/f with u = −30, f = −20 gives 1/v = −1/20 + 1/30 = −1/60, so v = −60 cm — real and in front. m = −v/u = −2, so it is inverted and twice the size.',
  },
  {
    topicId: 'p12-ray-optics-optical-instruments-lens-maker-s-formula-including-a-lens-in',
    question: 'A thin converging glass lens is fully immersed in a liquid whose refractive index is greater than that of the glass. The lens',
    options: [
      'stays converging with the same focal length',
      'stays converging but with a longer focal length',
      'becomes diverging',
      'has infinite focal length',
    ],
    answer: 2,
    explain: 'In a medium the lens maker’s formula uses (n_lens/n_medium − 1). When the medium is denser this factor turns negative, flipping the sign of the power — the converging lens now diverges.',
  },
  {
    topicId: 'p12-ray-optics-optical-instruments-lens-and-mirror-combinations-tracking-th',
    question: 'An object sits 20 cm in front of a convex lens of focal length 10 cm, with a plane mirror 30 cm behind the lens. The image formed by the lens alone lies',
    options: ['20 cm behind the lens', '20 cm in front of the lens', '10 cm behind the lens', '30 cm behind the lens'],
    answer: 0,
    explain: '1/v = 1/f + 1/u = 1/10 − 1/20 = 1/20, so v = +20 cm. That image then becomes the object for the mirror, 10 cm in front of it. Combinations are always tracked one element at a time.',
  },
  {
    topicId: 'p12-ray-optics-optical-instruments-total-internal-reflection-and-the-critic',
    question: 'The critical angle for a medium of refractive index √2 in contact with air is',
    options: ['30°', '45°', '60°', '90°'],
    answer: 1,
    explain: 'sin C = 1/n = 1/√2, so C = 45°. Total internal reflection needs light travelling from denser to rarer at an angle beyond C.',
  },
  {
    topicId: 'p12-ray-optics-optical-instruments-prism-deviation-and-the-minimum-deviatio',
    question: 'A prism of refracting angle 60° produces a minimum deviation of 30°. Its refractive index is',
    options: ['1.33', '√2', '1.5', '√3'],
    answer: 1,
    explain: 'n = sin((A + δm)/2) / sin(A/2) = sin 45° / sin 30° = 0.707/0.5 = √2. At minimum deviation the ray passes symmetrically, so i = e.',
  },
  {
    topicId: 'p12-ray-optics-optical-instruments-microscope-and-telescope-magnification',
    question: 'For an astronomical telescope in normal adjustment, the magnifying power is',
    options: ['f_o / f_e', 'f_e / f_o', 'f_o × f_e', '1 + D/f_e'],
    answer: 0,
    explain: 'M = f_o/f_e, and the tube length is f_o + f_e. The (1 + D/f_e) form belongs to the eyepiece of a microscope, not this.',
  },

  // ----------------------------------------- Physics 12 · Semiconductor Electronics
  {
    topicId: 'p12-semiconductor-electronics-intrinsic-vs-extrinsic-semiconductors-n-',
    question: 'Doping pure silicon with a pentavalent impurity such as phosphorus gives',
    options: [
      'p-type material with holes as majority carriers',
      'n-type material with electrons as majority carriers',
      'an intrinsic semiconductor',
      'an insulator',
    ],
    answer: 1,
    explain: 'Phosphorus has five valence electrons; four bond with silicon and the fifth is nearly free. It donates electrons, so the material is n-type. Trivalent dopants such as boron give p-type.',
  },
  {
    topicId: 'p12-semiconductor-electronics-the-p-n-junction-depletion-region-and-ba',
    question: 'The depletion region of an unbiased p-n junction contains',
    options: [
      'only free electrons',
      'only holes',
      'immobile ionised donor and acceptor atoms, with essentially no free carriers',
      'equal numbers of free electrons and holes',
    ],
    answer: 2,
    explain: 'Diffusion across the junction leaves behind fixed ionised cores on both sides. Those charges set up the barrier potential, and the region is depleted of mobile carriers — hence the name.',
  },
  {
    topicId: 'p12-semiconductor-electronics-diode-characteristics-under-forward-and-',
    question: 'When a p-n junction diode is reverse biased, the width of the depletion layer',
    options: ['decreases', 'increases', 'stays unchanged', 'falls to zero'],
    answer: 1,
    explain: 'Reverse bias pulls majority carriers away from the junction, widening the depletion layer and raising the barrier. Forward bias does the opposite and lets current flow.',
  },
  {
    topicId: 'p12-semiconductor-electronics-half-wave-and-full-wave-rectifiers',
    question: 'A full-wave rectifier is fed from a 50 Hz AC supply. The ripple frequency of its output is',
    options: ['25 Hz', '50 Hz', '100 Hz', '200 Hz'],
    answer: 2,
    explain: 'A full-wave rectifier delivers one output pulse per half cycle, so the ripple is at twice the input frequency. A half-wave rectifier would ripple at 50 Hz.',
  },
  {
    topicId: 'p12-semiconductor-electronics-zener-diode-as-a-voltage-regulator',
    question: 'A Zener diode acting as a voltage regulator is operated in',
    options: [
      'forward bias below the knee voltage',
      'reverse bias, within the breakdown region',
      'forward bias above the knee voltage',
      'the unbiased state',
    ],
    answer: 1,
    explain: 'In reverse breakdown the voltage across a Zener stays almost constant while the current varies widely — precisely what a regulator needs. The breakdown is non-destructive if current is limited.',
  },
  {
    topicId: 'p12-semiconductor-electronics-logic-gates-and-their-truth-tables',
    question: 'The output of a two-input NAND gate is LOW (0) only when',
    options: ['any one input is 0', 'both inputs are 1', 'both inputs are 0', 'the two inputs differ'],
    answer: 1,
    explain: 'NAND is AND followed by NOT. AND gives 1 only for 1,1 — so NAND gives 0 only for 1,1 and 1 in every other case.',
  },

  // --------------------------------- Physics 12 · Electrostatic Potential & Capacitance
  {
    topicId: 'p12-electrostatic-potential-capacitance-potential-due-to-point-charges-and-conti',
    question: 'A ring of radius R carries a total charge Q spread uniformly. At its centre,',
    options: [
      'both the field and the potential are zero',
      'the field is zero but the potential is kQ/R',
      'the field is kQ/R² and the potential is zero',
      'both the field and the potential are kQ/R',
    ],
    answer: 1,
    explain: 'Field contributions from diametrically opposite elements cancel as vectors, so E = 0. Potential is a scalar, so every element adds: V = kQ/R. Zero field never implies zero potential.',
  },
  {
    topicId: 'p12-electrostatic-potential-capacitance-equipotential-surfaces-and-why-field-is-',
    question: 'The work done in moving a charge between two points on the same equipotential surface is',
    options: ['positive', 'negative', 'zero', 'dependent on the path taken'],
    answer: 2,
    explain: 'W = qΔV and ΔV = 0 on an equipotential surface, so no work is done by any path. This is also why field lines meet equipotentials at right angles — any tangential component would do work.',
  },
  {
    topicId: 'p12-electrostatic-potential-capacitance-conductors-in-electrostatic-equilibrium-',
    question: 'Inside the material of a charged conductor in electrostatic equilibrium,',
    options: [
      'E = 0 and V = 0',
      'E = 0 and V is constant, equal to its surface value',
      'E is constant and V = 0',
      'both E and V vary from point to point',
    ],
    answer: 1,
    explain: 'Free charges rearrange until the interior field vanishes. Zero field means no potential difference, so the whole conductor sits at one potential — not necessarily zero.',
  },
  {
    topicId: 'p12-electrostatic-potential-capacitance-capacitance-of-parallel-plate-spherical-',
    question: 'The capacitance of an air-filled parallel plate capacitor is doubled by',
    options: [
      'doubling the plate separation',
      'halving the plate separation',
      'halving the plate area',
      'doubling the charge on the plates',
    ],
    answer: 1,
    explain: 'C = ε₀A/d, so halving d doubles C. Capacitance is fixed by geometry and the medium alone — putting more charge on the plates does not change it.',
  },
  {
    topicId: 'p12-electrostatic-potential-capacitance-dielectrics-polarisation-and-the-effect-',
    question: 'A dielectric slab of constant K is inserted so that it completely fills a parallel plate capacitor that remains connected to a battery. The charge stored',
    options: ['falls by a factor K', 'rises by a factor K', 'is unchanged', 'becomes zero'],
    answer: 1,
    explain: 'With the battery attached V is fixed and C rises to KC, so Q = CV rises K times. Had the capacitor been isolated first, Q would be fixed and V would drop by K instead — always check which quantity is held constant.',
  },
  {
    topicId: 'p12-electrostatic-potential-capacitance-capacitor-networks-and-energy-stored',
    question: 'Capacitors of 2 μF and 3 μF are joined in series across a 10 V supply. The total energy stored is',
    options: ['30 μJ', '60 μJ', '100 μJ', '250 μJ'],
    answer: 1,
    explain: 'In series C_eq = (2×3)/(2+3) = 1.2 μF. U = ½CV² = ½ × 1.2 μF × 100 = 60 μJ.',
  },

  // ------------------------------------------------- Chemistry 12 · Solutions
  {
    topicId: 'c12-solutions-concentration-terms-and-interconverting-',
    question: '18 g of glucose (molar mass 180 g mol⁻¹) is dissolved in 1 kg of water. The molality of the solution is',
    options: ['0.01 m', '0.1 m', '0.18 m', '1.0 m'],
    answer: 1,
    explain: '18/180 = 0.1 mol in 1 kg of solvent, so m = 0.1. Note molality uses mass of solvent, which is why it does not change with temperature — molarity does.',
  },
  {
    topicId: 'c12-solutions-henry-s-law-and-the-solubility-of-gases',
    question: 'As temperature rises, the solubility of a gas in a liquid',
    options: [
      'increases, because K_H increases',
      'decreases, because K_H increases',
      'increases, because K_H decreases',
      'is unaffected by temperature',
    ],
    answer: 1,
    explain: 'p = K_H·x, so x = p/K_H. Heating raises K_H, which lowers x. Dissolution of a gas is exothermic, so warming drives it out — warm soda goes flat.',
  },
  {
    topicId: 'c12-solutions-raoult-s-law-and-relative-lowering-of-va',
    question: 'For a solution containing a non-volatile solute, the relative lowering of vapour pressure is equal to the',
    options: [
      'mole fraction of the solvent',
      'mole fraction of the solute',
      'molality of the solute',
      'molarity of the solute',
    ],
    answer: 1,
    explain: '(p° − p)/p° = x_solute. It is the SOLUTE’s mole fraction — picking the solvent here is the classic slip, and it is what makes this a colligative property.',
  },
  {
    topicId: 'c12-solutions-ideal-and-non-ideal-solutions-and-azeotr',
    question: 'A binary mixture showing positive deviation from Raoult’s law forms',
    options: [
      'a maximum boiling azeotrope',
      'a minimum boiling azeotrope',
      'no azeotrope at any composition',
      'an ideal solution',
    ],
    answer: 1,
    explain: 'Positive deviation means weaker A–B interactions, so vapour pressure is higher than predicted and the boiling point dips to a minimum. Ethanol + water is the standard example.',
  },
  {
    topicId: 'c12-solutions-elevation-of-boiling-point-and-depressio',
    question: 'Equal masses of glucose (180 g mol⁻¹) and urea (60 g mol⁻¹) are dissolved in separate but equal masses of water. The depression in freezing point is',
    options: [
      'the same for both solutions',
      'three times greater for the urea solution',
      'three times greater for the glucose solution',
      'twice as great for the urea solution',
    ],
    answer: 1,
    explain: 'ΔT_f = K_f·m depends on the number of particles. Equal mass of a solute with one-third the molar mass gives three times the moles, so three times the depression.',
  },
  {
    topicId: 'c12-solutions-osmosis-and-osmotic-pressure',
    question: 'Red blood cells placed in pure water swell and eventually burst because',
    options: [
      'pure water is hypertonic to the cell contents',
      'pure water is hypotonic, so water flows into the cell',
      'salts diffuse out of the cell into the water',
      'the osmotic pressure of pure water is very high',
    ],
    answer: 1,
    explain: 'Pure water is hypotonic — lower solute concentration than the cytoplasm — so solvent moves in, down its own concentration gradient, until the membrane fails (haemolysis).',
  },
  {
    topicId: 'c12-solutions-van-t-hoff-factor-and-abnormal-molar-mas',
    question: 'Assuming complete dissociation, the van’t Hoff factor for a dilute aqueous solution of K₂SO₄ is',
    options: ['1', '2', '3', '4'],
    answer: 2,
    explain: 'K₂SO₄ → 2K⁺ + SO₄²⁻ gives three particles, so i = 3. Count every ion. Association works the other way: benzoic acid dimerises in benzene, giving i = 0.5.',
  },

  // =============================================================== CLASS 11 CHEMISTRY
  // ------------------------------- Chemistry 11 · Some Basic Concepts of Chemistry
  {
    topicId: 'c11-some-basic-concepts-of-chemistry-the-mole-concept-and-avogadro-s-number',
    question: 'One mole of any substance contains',
    options: ['1 gram of it', '6.022 × 10²³ particles', '22.4 grams of it', '1 litre of it'],
    answer: 1,
    explain: 'A mole is a fixed count, not a fixed mass or volume. The 22.4 litre figure applies to a GAS at STP only, and never to solids or liquids.',
  },
  {
    topicId: 'c11-some-basic-concepts-of-chemistry-empirical-and-molecular-formulae',
    question: 'The empirical formula of a compound gives',
    options: [
      'the actual number of atoms in one molecule',
      'the simplest whole-number ratio of the atoms present',
      'the molar mass of the compound',
      'the arrangement of atoms in space',
    ],
    answer: 1,
    explain: 'The molecular formula is a whole-number multiple of it, and you need the molar mass to find that multiple. Benzene is C₆H₆ molecularly but CH empirically.',
  },
  {
    topicId: 'c11-some-basic-concepts-of-chemistry-stoichiometry-and-the-limiting-reagent',
    question: 'The limiting reagent in a reaction is the reactant that',
    options: [
      'is present in the largest amount',
      'is consumed completely first and therefore fixes how much product forms',
      'acts as a catalyst',
      'remains unreacted at the end',
    ],
    answer: 1,
    explain: 'It is decided by the mole ratio required by the equation, not by mass. Comparing raw masses rather than moles-per-coefficient is the standard mistake.',
  },
  {
    topicId: 'c11-some-basic-concepts-of-chemistry-concentration-terms-and-their-temperatur',
    question: 'Which concentration term changes when the temperature changes?',
    options: ['Molality', 'Mole fraction', 'Molarity', 'Mass percentage'],
    answer: 2,
    explain: 'Molarity is defined per litre of solution, and volume expands on heating. The other three are all defined by mass or by mole ratios, so they are temperature independent.',
  },

  // ------------------------- Chemistry 11 · Chemical Bonding & Molecular Structure
  {
    topicId: 'c11-chemical-bonding-molecular-structure-ionic-vs-covalent-character-fajans-rules',
    question: 'By Fajans’ rules, covalent character in an ionic compound is greatest when the cation is',
    options: [
      'large with a low charge',
      'small with a high charge',
      'the same size as the anion',
      'uncharged',
    ],
    answer: 1,
    explain: 'A small, highly charged cation polarises the anion strongly, distorting its electron cloud towards the shared region. A large, easily polarised anion has the same effect — which is why LiI is far more covalent than LiF.',
  },
  {
    topicId: 'c11-chemical-bonding-molecular-structure-vsepr-predicting-shape-and-bond-angles',
    question: 'The shape of the ammonia molecule is',
    options: ['trigonal planar', 'trigonal pyramidal', 'tetrahedral', 'linear'],
    answer: 1,
    explain: 'Four electron pairs give tetrahedral GEOMETRY, but one is a lone pair, so the observed SHAPE is trigonal pyramidal. Lone pair repulsion also squeezes the bond angle to 107° rather than 109.5°.',
  },
  {
    topicId: 'c11-chemical-bonding-molecular-structure-hybridisation-and-its-relation-to-geomet',
    question: 'sp² hybridisation gives rise to a geometry that is',
    options: ['linear', 'trigonal planar', 'tetrahedral', 'octahedral'],
    answer: 1,
    explain: 'Three hybrid orbitals arrange at 120° in a plane, leaving one unhybridised p orbital perpendicular to it — which is what forms the π bond in ethene. sp is linear, sp³ tetrahedral, sp³d² octahedral.',
  },
  {
    topicId: 'c11-chemical-bonding-molecular-structure-molecular-orbital-theory-for-diatomics-b',
    question: 'The paramagnetism of the O₂ molecule is explained by',
    options: [
      'valence bond theory',
      'molecular orbital theory, which places two unpaired electrons in π* orbitals',
      'VSEPR theory',
      'Fajans’ rules',
    ],
    answer: 1,
    explain: 'VBT predicts a doubly bonded O=O with every electron paired, and therefore the wrong magnetic behaviour. MOT gives bond order 2 AND two unpaired electrons in degenerate antibonding orbitals — its most celebrated success.',
  },
  {
    topicId: 'c11-chemical-bonding-molecular-structure-hydrogen-bonding-and-its-physical-conseq',
    question: 'Water boils at a far higher temperature than H₂S because',
    options: [
      'water has a greater molar mass',
      'water molecules form intermolecular hydrogen bonds',
      'water is more covalent in character',
      'H₂S is an ionic compound',
    ],
    answer: 1,
    explain: 'Water is actually the LIGHTER molecule, so mass cannot be the reason. Hydrogen bonding needs H attached to N, O or F, and sulphur is not electronegative enough to qualify.',
  },
  {
    topicId: 'c11-chemical-bonding-molecular-structure-dipole-moment-and-molecular-polarity',
    question: 'CO₂ has a zero dipole moment because',
    options: [
      'its C=O bonds are non-polar',
      'it is linear, so the two equal bond dipoles cancel',
      'it contains no lone pairs on carbon',
      'it is a gas at room temperature',
    ],
    answer: 1,
    explain: 'The individual bonds are strongly polar; it is the symmetry that cancels them. Water has similarly polar bonds but is bent, so its dipoles add to a substantial net moment — shape decides polarity.',
  },

  // ------------------------------------------------------ Chemistry 11 · Equilibrium
  {
    topicId: 'c11-equilibrium-kp-kc-and-the-relation-between-them',
    question: 'Kp and Kc are numerically equal when',
    options: ['Δn = 0', 'Δn > 0', 'Δn < 0', 'always, for every reaction'],
    answer: 0,
    explain: 'Kp = Kc(RT)^Δn, where Δn counts moles of gaseous products minus reactants. With Δn = 0 the factor becomes 1. Only GASEOUS species are counted in Δn.',
  },
  {
    topicId: 'c11-equilibrium-le-chatelier-s-principle-applied-to-real',
    question: 'Raising the temperature of an exothermic reaction at equilibrium',
    options: [
      'shifts it towards the products',
      'shifts it towards the reactants',
      'has no effect on the position of equilibrium',
      'stops the reaction entirely',
    ],
    answer: 1,
    explain: 'Heat is effectively a product, so adding it drives the system backwards and lowers K. Temperature is the only factor that changes the value of the equilibrium constant — a catalyst never does.',
  },
  {
    topicId: 'c11-equilibrium-ionic-equilibrium-ph-poh-and-strong-weak',
    question: 'A solution of pH 3 is more acidic than one of pH 6 by a factor of',
    options: ['3', '30', '100', '1000'],
    answer: 3,
    explain: 'pH is logarithmic, so each unit is a tenfold change in [H⁺]. Three units means 10³ = 1000 times. A tenfold dilution of a strong acid therefore moves pH by exactly one unit.',
  },
  {
    topicId: 'c11-equilibrium-buffers-and-the-henderson-hasselbalch-eq',
    question: 'A buffer solution resists changes in pH because it contains',
    options: [
      'a strong acid together with a strong base',
      'a weak acid together with its conjugate base, or the base equivalent',
      'only pure water',
      'a neutral salt of a strong acid and strong base',
    ],
    answer: 1,
    explain: 'One component mops up added acid and the other added base. Buffering is most effective when the two are present in comparable amounts, which is where pH equals pKa.',
  },
  {
    topicId: 'c11-equilibrium-solubility-product-and-the-common-ion-ef',
    question: 'Adding sodium chloride to a saturated solution of silver chloride causes the solubility of AgCl to',
    options: ['increase', 'decrease', 'remain unchanged', 'fall to exactly zero'],
    answer: 1,
    explain: 'The extra chloride ions push the equilibrium back towards undissolved solid, so less AgCl dissolves. Ksp itself is untouched — only the position of the equilibrium moves. This is the common ion effect.',
  },
  {
    topicId: 'c11-equilibrium-salt-hydrolysis-and-predicting-the-resul',
    question: 'An aqueous solution of sodium acetate is',
    options: ['acidic', 'basic', 'exactly neutral', 'amphoteric'],
    answer: 1,
    explain: 'It is the salt of a weak acid and a strong base, so the acetate ion hydrolyses to give OH⁻. Reverse the pairing, as in ammonium chloride, and the solution is acidic instead.',
  },

  // ------------------------------------------------- Chemistry 11 · Structure of Atom
  {
    topicId: 'c11-structure-of-atom-the-bohr-model-and-where-it-breaks-down',
    question: 'Bohr’s model failed to account for',
    options: [
      'the line spectrum of hydrogen',
      'the spectra of multi-electron atoms and the splitting of spectral lines',
      'the existence of the atomic number',
      'the mass of the nucleus',
    ],
    answer: 1,
    explain: 'It works only for one-electron systems. It also cannot accommodate the uncertainty principle, since it assumes an electron has a definite orbit with a definite radius and speed.',
  },
  {
    topicId: 'c11-structure-of-atom-quantum-numbers-and-the-shapes-of-orbita',
    question: 'The azimuthal quantum number l determines the',
    options: ['size of the orbital', 'shape of the orbital', 'orientation of the orbital', 'spin of the electron'],
    answer: 1,
    explain: 'n fixes size and energy, l the shape (s, p, d, f), m the orientation in space, and s the spin. Mixing up l and m is the usual slip.',
  },
  {
    topicId: 'c11-structure-of-atom-aufbau-principle-pauli-exclusion-and-hun',
    question: 'Hund’s rule states that',
    options: [
      'electrons pair in an orbital before occupying separate ones',
      'orbitals of equal energy are each singly filled before any pairing occurs',
      'no two electrons in an atom share all four quantum numbers',
      'lower energy orbitals are filled first',
    ],
    answer: 1,
    explain: 'Singly occupying degenerate orbitals with parallel spins minimises repulsion. The third option is the Pauli exclusion principle and the fourth is the Aufbau principle — three different rules that are easy to blur together.',
  },
  {
    topicId: 'c11-structure-of-atom-dual-nature-de-broglie-and-heisenberg-un',
    question: 'The Heisenberg uncertainty principle says it is impossible to determine simultaneously and exactly',
    options: [
      'the mass and charge of an electron',
      'the position and the momentum of an electron',
      'the energy and the charge of an electron',
      'the spin and the mass of an electron',
    ],
    answer: 1,
    explain: 'Δx·Δp ≥ h/4π. The limit is fundamental rather than a shortcoming of our instruments, and it is why orbitals are probability regions rather than paths.',
  },

  // ------------------------------ Chemistry 11 · Classification of Elements & Periodicity
  {
    topicId: 'c11-classification-of-elements-periodicity-modern-periodic-law-and-the-s-p-d-f-bloc',
    question: 'An element whose configuration ends in 3d⁵4s¹ belongs to the',
    options: ['s-block', 'p-block', 'd-block', 'f-block'],
    answer: 2,
    explain: 'The block is named for the subshell being filled, here 3d. This is chromium, whose half-filled d⁵ arrangement is extra stable and is why it borrows an electron from 4s.',
  },
  {
    topicId: 'c11-classification-of-elements-periodicity-atomic-and-ionic-radii-trends',
    question: 'Moving left to right across a period, the atomic radius',
    options: ['increases', 'decreases', 'stays constant', 'increases then decreases'],
    answer: 1,
    explain: 'Nuclear charge grows while electrons enter the same shell, so the pull on them tightens. Down a group the radius increases instead, because a new shell is added each time.',
  },
  {
    topicId: 'c11-classification-of-elements-periodicity-ionisation-enthalpy-trends-and-the-excep',
    question: 'The first ionisation enthalpy of boron is LOWER than that of beryllium because',
    options: [
      'boron has a larger atomic radius',
      'beryllium has a completely filled 2s subshell, which is extra stable',
      'boron has fewer protons',
      'boron is a metal and beryllium is not',
    ],
    answer: 1,
    explain: 'Removing boron’s lone 2p electron is easier than breaking into beryllium’s filled 2s. The same stability argument explains the dip from nitrogen (half-filled 2p³) to oxygen.',
  },
  {
    topicId: 'c11-classification-of-elements-periodicity-electron-gain-enthalpy-and-electronegati',
    question: 'The most electronegative element in the periodic table is',
    options: ['chlorine', 'fluorine', 'oxygen', 'nitrogen'],
    answer: 1,
    explain: 'Fluorine tops the electronegativity scale. Note that CHLORINE has the more negative electron gain enthalpy — the two properties measure different things and this is the case where they disagree.',
  },

  // -------------------------------------------------- Chemistry 11 · Thermodynamics
  {
    topicId: 'c11-thermodynamics-system-surroundings-and-state-functions',
    question: 'Which of the following is NOT a state function?',
    options: ['Enthalpy', 'Entropy', 'Work', 'Internal energy'],
    answer: 2,
    explain: 'Work and heat depend on the path taken, not just the endpoints, so they are path functions. This is exactly why an isothermal and an adiabatic route between the same two states involve different amounts of work.',
  },
  {
    topicId: 'c11-thermodynamics-first-law-enthalpy-and-heat-capacity',
    question: 'At constant pressure, the heat exchanged by a system equals',
    options: ['ΔU', 'ΔH', 'ΔS', 'ΔG'],
    answer: 1,
    explain: 'q_p = ΔH, which is why enthalpy is the convenient quantity for reactions in open vessels. At constant VOLUME the heat equals ΔU instead, since no expansion work is done.',
  },
  {
    topicId: 'c11-thermodynamics-hess-s-law-and-enthalpies-of-reaction',
    question: 'Hess’s law is a direct consequence of the fact that',
    options: [
      'enthalpy is a state function',
      'entropy always increases',
      'energy cannot be created',
      'equilibria shift to oppose change',
    ],
    answer: 0,
    explain: 'Because ΔH depends only on initial and final states, the total is the same whether the reaction runs in one step or several. That is what lets you add thermochemical equations like algebra.',
  },
  {
    topicId: 'c11-thermodynamics-entropy-spontaneity-and-gibbs-free-energ',
    question: 'A process is spontaneous at constant temperature and pressure when',
    options: ['ΔH < 0 in every case', 'ΔG < 0', 'ΔS of the system < 0', 'ΔG > 0'],
    answer: 1,
    explain: 'ΔG = ΔH − TΔS decides it, not ΔH alone. Endothermic processes can be spontaneous if the entropy gain is large enough — melting ice above 0 °C is the everyday example.',
  },

  // ------------------------------------------------- Chemistry 11 · Redox Reactions
  {
    topicId: 'c11-redox-reactions-rules-for-assigning-oxidation-numbers',
    question: 'The oxidation number of sulphur in H₂SO₄ is',
    options: ['+2', '+4', '+6', '−2'],
    answer: 2,
    explain: 'Hydrogen contributes +1 each and oxygen −2 each, so 2(+1) + x + 4(−2) = 0 gives x = +6. Oxidation number is a bookkeeping device and may well be fractional, as in Fe₃O₄.',
  },
  {
    topicId: 'c11-redox-reactions-identifying-oxidising-and-reducing-agent',
    question: 'In a redox reaction, the oxidising agent',
    options: [
      'loses electrons and is itself oxidised',
      'gains electrons and is itself reduced',
      'neither gains nor loses electrons',
      'merely acts as a catalyst',
    ],
    answer: 1,
    explain: 'The oxidising agent oxidises something else by taking its electrons, so it is reduced in the process. The naming refers to what it does to the OTHER species, which is why it reads backwards at first.',
  },
  {
    topicId: 'c11-redox-reactions-balancing-redox-equations',
    question: 'When balancing a redox half-equation in acidic medium, oxygen is balanced by',
    options: [
      'adding O₂ molecules',
      'adding H₂O to the oxygen-deficient side and H⁺ to the other side',
      'adding OH⁻ ions',
      'adding electrons',
    ],
    answer: 1,
    explain: 'Water supplies the oxygen and H⁺ then balances the hydrogen. In BASIC medium you use OH⁻ instead — applying the acidic recipe to a basic medium is the standard error.',
  },

  // ---------------------- Chemistry 11 · Organic Chemistry: Basic Principles & Techniques
  {
    topicId: 'c11-organic-chemistry-basic-principles-techn-iupac-nomenclature-of-organic-compounds',
    question: 'In IUPAC nomenclature the principal chain is chosen as',
    options: [
      'the longest carbon chain, regardless of anything else',
      'the longest chain that contains the principal functional group',
      'the shortest chain available',
      'any chain, since the choice does not affect the name',
    ],
    answer: 1,
    explain: 'The functional group outranks chain length, and numbering then gives that group the lowest possible locant. Picking the longest chain while ignoring the functional group is the classic error.',
  },
  {
    topicId: 'c11-organic-chemistry-basic-principles-techn-structural-isomerism-and-stereoisomerism',
    question: 'Compounds sharing a molecular formula but differing in the order in which the atoms are joined are',
    options: ['stereoisomers', 'structural isomers', 'conformers', 'identical compounds'],
    answer: 1,
    explain: 'Structural isomers differ in connectivity — chain, position, functional group, metamerism, tautomerism. Stereoisomers keep the same connectivity and differ only in spatial arrangement.',
  },
  {
    topicId: 'c11-organic-chemistry-basic-principles-techn-inductive-resonance-and-hyperconjugative',
    question: 'Hyperconjugation stabilises a carbocation by',
    options: [
      'donating a lone pair from an adjacent atom',
      'delocalising σ C–H bonding electrons into the empty p orbital',
      'withdrawing electron density inductively',
      'shifting π electrons of an adjacent double bond',
    ],
    answer: 1,
    explain: 'More α-hydrogens mean more such interactions, which is why stability rises 1° < 2° < 3°. Resonance involves π or lone pair electrons; hyperconjugation uniquely involves a σ bond.',
  },
  {
    topicId: 'c11-organic-chemistry-basic-principles-techn-carbocations-carbanions-and-free-radical',
    question: 'The stability order of carbocations is',
    options: ['1° > 2° > 3°', '3° > 2° > 1°', 'all are equally stable', '2° > 3° > 1°'],
    answer: 1,
    explain: 'Alkyl groups release electron density and provide hyperconjugation, both stabilising the positive centre. Carbanions run the opposite way, 1° > 2° > 3°, since they need electron density removed rather than supplied.',
  },
  {
    topicId: 'c11-organic-chemistry-basic-principles-techn-types-of-organic-reactions-and-electroph',
    question: 'An electrophile is a species that',
    options: [
      'donates a pair of electrons',
      'accepts a pair of electrons',
      'is always negatively charged',
      'always carries an unpaired electron',
    ],
    answer: 1,
    explain: 'Electrophiles are electron-poor and may be positive or neutral, as AlCl₃ and BF₃ are. Nucleophiles donate electron pairs and may likewise be neutral, such as H₂O or NH₃ — charge is not the deciding factor.',
  },

  // -------------------------------------------------------- Chemistry 11 · Hydrocarbons
  {
    topicId: 'c11-hydrocarbons-alkanes-and-free-radical-substitution',
    question: 'The chlorination of methane in sunlight proceeds by',
    options: [
      'electrophilic addition',
      'a free radical chain mechanism',
      'nucleophilic substitution',
      'elimination',
    ],
    answer: 1,
    explain: 'Light homolytically splits Cl₂ to start the chain, which then propagates and eventually terminates. Because it is a chain, the reaction is hard to stop cleanly at monochlorination.',
  },
  {
    topicId: 'c11-hydrocarbons-alkenes-electrophilic-addition-and-marko',
    question: 'Adding HBr to propene in the ABSENCE of peroxide gives mainly',
    options: ['1-bromopropane', '2-bromopropane', 'equal amounts of both', 'no reaction'],
    answer: 1,
    explain: 'Markovnikov addition puts the hydrogen on the carbon that already has more hydrogens, forming the more stable secondary carbocation. Peroxides flip this to anti-Markovnikov via free radicals — and that effect works with HBr only, not HCl or HI.',
  },
  {
    topicId: 'c11-hydrocarbons-alkynes-acidity-and-addition-reactions',
    question: 'Terminal alkynes are acidic enough to react with sodium metal because',
    options: [
      'the sp-hybridised carbon holds the C–H electrons more tightly, stabilising the resulting anion',
      'they contain two π bonds',
      'they are unsaturated hydrocarbons',
      'they are non-polar molecules',
    ],
    answer: 0,
    explain: 'An sp carbon has 50% s character, so its electrons sit closer to the nucleus and the carbanion is better stabilised. Acidity therefore runs alkyne > alkene > alkane, and only TERMINAL alkynes have such a hydrogen.',
  },
  {
    topicId: 'c11-hydrocarbons-aromaticity-and-electrophilic-aromatic-s',
    question: 'For a compound to be aromatic it must be',
    options: [
      'cyclic, planar, fully conjugated and hold (4n + 2) π electrons',
      'cyclic, and nothing more',
      'saturated and cyclic',
      'cyclic with 4n π electrons',
    ],
    answer: 0,
    explain: 'All four conditions of Hückel’s rule must hold together. A cyclic conjugated system with 4n π electrons is ANTI-aromatic and notably unstable, as cyclobutadiene is.',
  },
  {
    topicId: 'c11-hydrocarbons-directive-influence-of-substituents-on-t',
    question: 'A nitro group already attached to a benzene ring is',
    options: [
      'activating and ortho/para directing',
      'deactivating and meta directing',
      'activating and meta directing',
      'deactivating and ortho/para directing',
    ],
    answer: 1,
    explain: 'Electron-withdrawing groups deactivate the ring and direct incoming electrophiles to the meta position. Halogens are the famous exception — deactivating through induction yet ortho/para directing through resonance.',
  },

  // --------------- Chemistry 11 · Purification & Characterisation of Organic Compounds
  {
    topicId: 'c11-purification-characterisation-of-organic-purification-distillation-crystallisatio',
    question: 'Chromatography separates the components of a mixture on the basis of',
    options: [
      'their boiling points',
      'their differing affinity for a stationary and a mobile phase',
      'their molar masses alone',
      'their colours',
    ],
    answer: 1,
    explain: 'Components that cling harder to the stationary phase travel more slowly. Distillation is the technique that separates by boiling point, and fractional distillation handles liquids whose boiling points lie close together.',
  },
  {
    topicId: 'c11-purification-characterisation-of-organic-detection-of-elements-and-quantitative-e',
    question: 'Halogens in an organic compound are estimated quantitatively by',
    options: ['Kjeldahl’s method', 'the Carius method', 'Dumas method', 'Liebig’s method'],
    answer: 1,
    explain: 'Carius estimates halogens and also sulphur. Kjeldahl and Dumas both estimate nitrogen, and Liebig’s combustion method gives carbon and hydrogen.',
  },

  // -------------------------------- Chemistry 11 · The p-Block Elements (Groups 13 & 14)
  {
    topicId: 'c11-the-p-block-elements-groups-13-14-group-13-trends-and-important-compounds',
    question: 'The inert pair effect explains why',
    options: [
      'boron shows an oxidation state of +1',
      'heavier members favour an oxidation state two below the group value, as in Tl⁺ and Pb²⁺',
      'all group members show only the group oxidation state',
      'these elements are chemically inert',
    ],
    answer: 1,
    explain: 'The ns² pair becomes increasingly reluctant to take part in bonding down the group, thanks to poor shielding by intervening d and f electrons. So Tl⁺ beats Tl³⁺ in stability, and Pb²⁺ beats Pb⁴⁺.',
  },
  {
    topicId: 'c11-the-p-block-elements-groups-13-14-group-14-allotropes-trends-and-important',
    question: 'Within group 14, the tendency to catenate is greatest for',
    options: ['carbon', 'silicon', 'germanium', 'lead'],
    answer: 0,
    explain: 'The C–C bond is by far the strongest self-linkage in the group, which is the whole reason organic chemistry exists. Bond strength falls sharply down the group as the atoms grow.',
  },

  // ------------------------------------------------- Chemistry 11 · s-Block Elements
  {
    topicId: 'c11-s-block-elements-alkali-and-alkaline-earth-metals-periodi',
    question: 'Descending group 1, the first ionisation enthalpy',
    options: ['increases', 'decreases', 'stays constant', 'first rises then falls'],
    answer: 1,
    explain: 'The outer electron sits further out and is better shielded, so it is easier to remove. This is why reactivity increases down the group — the opposite of the halogens.',
  },
  {
    topicId: 'c11-s-block-elements-anomalous-behaviour-and-the-diagonal-rel',
    question: 'Lithium behaves anomalously compared with the other alkali metals mainly because of its',
    options: [
      'very small size and consequently high polarising power',
      'unusually large atomic radius',
      'very low electronegativity',
      'high density',
    ],
    answer: 0,
    explain: 'A small, highly polarising Li⁺ gives its compounds more covalent character. The same property produces the diagonal relationship with magnesium, which it resembles more than it does sodium.',
  },
  {
    topicId: 'c11-hydrogen-position-of-hydrogen-its-isotopes-and-pr',
    question: 'The radioactive isotope of hydrogen is',
    options: ['protium', 'deuterium', 'tritium', 'none of them'],
    answer: 2,
    explain: 'Tritium has two neutrons and is a beta emitter with a half-life near 12.3 years. Protium and deuterium are both stable, and hydrogen sits awkwardly in the table because it resembles both group 1 and group 17.',
  },
  {
    topicId: 'c11-hydrogen-hydrides-and-the-hardness-of-water',
    question: 'Temporary hardness of water is caused by',
    options: [
      'chlorides and sulphates of calcium and magnesium',
      'bicarbonates of calcium and magnesium',
      'dissolved sodium salts',
      'dissolved gases',
    ],
    answer: 1,
    explain: 'Bicarbonates decompose on boiling and precipitate out, so temporary hardness is removed simply by heating or by Clark’s method. Chlorides and sulphates cause PERMANENT hardness, which needs washing soda or an ion exchanger.',
  },

  // ------------------------- Chemistry 12 · Aldehydes, Ketones & Carboxylic Acids
  {
    topicId: 'c12-aldehydes-ketones-carboxylic-acids-nucleophilic-addition-and-the-reactivity',
    question: 'The order of reactivity towards nucleophilic addition is',
    options: [
      'acetone > acetaldehyde > formaldehyde',
      'formaldehyde > acetaldehyde > acetone',
      'acetaldehyde > formaldehyde > acetone',
      'all three react equally',
    ],
    answer: 1,
    explain: 'Alkyl groups both crowd the carbonyl carbon and push electron density onto it, so each one added slows the attack. Aldehydes therefore beat ketones, and formaldehyde beats everything.',
  },
  {
    topicId: 'c12-aldehydes-ketones-carboxylic-acids-aldol-and-cross-aldol-condensation',
    question: 'Which compound will NOT undergo the aldol condensation?',
    options: ['Acetaldehyde', 'Acetone', 'Benzaldehyde', 'Propanal'],
    answer: 2,
    explain: 'Aldol needs an α-hydrogen to form the enolate. Benzaldehyde has none, which is exactly why it undergoes Cannizzaro instead.',
  },
  {
    topicId: 'c12-aldehydes-ketones-carboxylic-acids-cannizzaro-reaction-and-the-no-hydrogen-',
    question: 'The Cannizzaro reaction is given by aldehydes that have',
    options: ['at least one α-hydrogen', 'no α-hydrogen', 'an aromatic ring only', 'a carboxyl group'],
    answer: 1,
    explain: 'With no α-hydrogen the enolate route is closed, so one molecule is oxidised and another reduced instead. HCHO and benzaldehyde are the standard examples — note it is the exact complement of the aldol condition.',
  },
  {
    topicId: 'c12-aldehydes-ketones-carboxylic-acids-clemmensen-vs-wolff-kishner-choosing-by-',
    question: 'To reduce a ketone to an alkane under ACIDIC conditions, the correct reagent is',
    options: [
      'NH₂NH₂ / KOH (Wolff–Kishner)',
      'Zn-Hg / HCl (Clemmensen)',
      'LiAlH₄',
      'NaBH₄',
    ],
    answer: 1,
    explain: 'Clemmensen is acidic, Wolff–Kishner is basic — you pick by which medium the rest of the molecule survives. LiAlH₄ and NaBH₄ stop at the alcohol rather than going all the way to the alkane.',
  },
  {
    topicId: 'c12-aldehydes-ketones-carboxylic-acids-distinguishing-tests-tollens-fehling-iod',
    question: 'Which of these gives a NEGATIVE Fehling’s test?',
    options: ['Formaldehyde', 'Acetaldehyde', 'Benzaldehyde', 'Propanal'],
    answer: 2,
    explain: 'Aromatic aldehydes do not respond to Fehling’s, though they do reduce Tollens’ reagent. Knowing which test fails for which compound is the whole point of the pair.',
  },
  {
    topicId: 'c12-aldehydes-ketones-carboxylic-acids-acidity-of-carboxylic-acids-and-substitu',
    question: 'Which is the strongest acid?',
    options: ['Acetic acid', 'Chloroacetic acid', 'Dichloroacetic acid', 'Trichloroacetic acid'],
    answer: 3,
    explain: 'Each electron-withdrawing chlorine pulls charge away from the carboxylate and stabilises it, so acidity climbs with the number of halogens. The effect also weakens sharply as the halogen moves further from the –COOH group.',
  },
  {
    topicId: 'c12-aldehydes-ketones-carboxylic-acids-conversion-sequences-and-naming-the-reag',
    question: 'The Rosenmund reduction converts an acyl chloride into',
    options: ['an alcohol', 'an aldehyde', 'an alkane', 'a carboxylic acid'],
    answer: 1,
    explain: 'H₂ over Pd poisoned with BaSO₄ stops the reduction at the aldehyde. Without the poison it would run on to the alcohol — the poison is the whole trick.',
  },

  // -------------------------------------------------- Chemistry 12 · Electrochemistry
  {
    topicId: 'c12-electrochemistry-electrochemical-cells-and-standard-elect',
    question: 'In a galvanic cell, oxidation takes place at the',
    options: ['cathode', 'anode', 'salt bridge', 'both electrodes'],
    answer: 1,
    explain: 'Oxidation is always at the anode and reduction at the cathode, in both cell types. What flips is the SIGN: the anode is negative in a galvanic cell but positive in an electrolytic one.',
  },
  {
    topicId: 'c12-electrochemistry-the-nernst-equation-and-cell-emf',
    question: 'The Nernst equation relates the cell potential to',
    options: [
      'the temperature alone',
      'the concentrations of the species taking part',
      'the current drawn from the cell',
      'the physical size of the electrodes',
    ],
    answer: 1,
    explain: 'It corrects E° for non-standard concentrations. Electrode SIZE never affects potential, since potential is an intensive property — only concentration, temperature and the reaction itself matter.',
  },
  {
    topicId: 'c12-electrochemistry-conductance-and-kohlrausch-s-law',
    question: 'On dilution, the MOLAR conductivity of an electrolyte',
    options: ['decreases', 'increases', 'stays constant', 'falls to zero'],
    answer: 1,
    explain: 'Molar conductivity rises because interionic attraction falls and weak electrolytes dissociate further. SPECIFIC conductivity moves the opposite way, since there are fewer ions per unit volume — confusing the two is the classic error.',
  },
  {
    topicId: 'c12-electrochemistry-electrolysis-and-faraday-s-laws',
    question: 'The quantity of electricity required to deposit one gram equivalent of a substance is',
    options: ['1 coulomb', '96500 coulombs', '6.022 × 10²³ coulombs', '1 ampere'],
    answer: 1,
    explain: 'One faraday, the charge on a mole of electrons. Note the ampere is a rate, not a quantity — charge is current multiplied by time.',
  },

  // ------------------------------------------------- Chemistry 12 · Chemical Kinetics
  {
    topicId: 'c12-chemical-kinetics-rate-of-reaction-and-the-rate-law',
    question: 'The rate law of a reaction',
    options: [
      'can be written directly from the balanced equation',
      'must be determined experimentally',
      'is always first order',
      'always matches the molecularity',
    ],
    answer: 1,
    explain: 'Stoichiometric coefficients give the rate law only for an elementary step. For everything else the exponents come from experiment, because they reflect the slowest step, not the overall equation.',
  },
  {
    topicId: 'c12-chemical-kinetics-order-versus-molecularity',
    question: 'The order of a reaction',
    options: [
      'is always a whole number',
      'may be zero or fractional, and is found experimentally',
      'always equals the molecularity',
      'can never be zero',
    ],
    answer: 1,
    explain: 'Order is experimental and may be zero, fractional or even negative. Molecularity counts the species colliding in an elementary step, so it must be a positive whole number.',
  },
  {
    topicId: 'c12-chemical-kinetics-integrated-rate-equations-and-half-life',
    question: 'For a first-order reaction, the half-life',
    options: [
      'depends on the initial concentration',
      'is independent of the initial concentration',
      'doubles with each successive half-life',
      'is always zero',
    ],
    answer: 1,
    explain: 't₁/₂ = 0.693/k, with no concentration term. This is why radioactive decay, which is first order, has a fixed half-life however much material you start with.',
  },
  {
    topicId: 'c12-chemical-kinetics-arrhenius-equation-activation-energy-and',
    question: 'A catalyst increases the rate of a reaction by',
    options: [
      'raising the activation energy',
      'providing an alternative path of lower activation energy',
      'changing the enthalpy of the reaction',
      'shifting the position of equilibrium',
    ],
    answer: 1,
    explain: 'It lowers the barrier for both forward and reverse reactions equally, so ΔH and the equilibrium constant are untouched. Equilibrium arrives sooner, not at a different place.',
  },

  // --------------------------------------------- Chemistry 12 · d- & f-Block Elements
  {
    topicId: 'c12-d-f-block-elements-general-characteristics-of-the-transitio',
    question: 'A transition element is one that has',
    options: [
      'completely filled d orbitals',
      'partially filled d orbitals in its atom or in a stable ion',
      'only s electrons in its valence shell',
      'partially filled f orbitals',
    ],
    answer: 1,
    explain: 'By this definition Zn, Cd and Hg are not typical transition metals — they are d¹⁰ in both the atom and the common ion, which is why they are colourless and form few complexes.',
  },
  {
    topicId: 'c12-d-f-block-elements-variable-oxidation-states-and-the-origin',
    question: 'Most transition metal ions are coloured because of',
    options: [
      'd–d electronic transitions',
      'their high density',
      'metallic bonding',
      'their large ionic size',
    ],
    answer: 0,
    explain: 'A partially filled d subshell allows an electron to absorb visible light and jump between split d levels. Sc³⁺ (d⁰) and Zn²⁺ (d¹⁰) have no such transition available, so both are colourless.',
  },
  {
    topicId: 'c12-d-f-block-elements-magnetic-properties-and-catalytic-behavi',
    question: 'Transition metals make good catalysts largely because they',
    options: [
      'are dense and hard',
      'show variable oxidation states and offer surfaces for adsorption',
      'are brightly coloured',
      'have high melting points',
    ],
    answer: 1,
    explain: 'Switching oxidation state lets them shuttle electrons through a reaction, and their surfaces adsorb reactants and weaken bonds. Iron in the Haber process and vanadium pentoxide in the Contact process both work this way.',
  },
  {
    topicId: 'c12-d-f-block-elements-lanthanoids-actinoids-and-lanthanoid-con',
    question: 'A direct consequence of the lanthanoid contraction is that',
    options: [
      'zirconium and hafnium have very different radii',
      'zirconium and hafnium have almost identical radii and are hard to separate',
      'all lanthanoids are radioactive',
      'the actinoids show only the +3 state',
    ],
    answer: 1,
    explain: 'Poor shielding by f electrons shrinks the lanthanoids steadily, cancelling the size increase expected further down. Second and third row transition metals therefore end up nearly the same size.',
  },

  // ------------------------------------------- Chemistry 12 · Haloalkanes & Haloarenes
  {
    topicId: 'c12-haloalkanes-haloarenes-nomenclature-and-methods-of-preparation',
    question: 'The best reagent for converting an alcohol to a chloroalkane in high purity is',
    options: ['concentrated HCl', 'thionyl chloride, SOCl₂', 'chlorine gas', 'sodium chloride'],
    answer: 1,
    explain: 'The by-products SO₂ and HCl are both gases and simply escape, leaving a pure product. Hydrogen halides can also trigger carbocation rearrangements, which SOCl₂ largely avoids.',
  },
  {
    topicId: 'c12-haloalkanes-haloarenes-sn1-and-sn2-mechanisms',
    question: 'A tertiary alkyl halide undergoes nucleophilic substitution predominantly by',
    options: [
      'SN2, because the carbon is easy to approach',
      'SN1, through a relatively stable carbocation',
      'neither mechanism',
      'both at equal rates',
    ],
    answer: 1,
    explain: 'Bulky groups block the backside attack SN2 requires, while the same groups stabilise the carbocation SN1 needs. Primary halides behave oppositely, and SN2 inverts configuration while SN1 tends to racemise.',
  },
  {
    topicId: 'c12-haloalkanes-haloarenes-elimination-reactions-and-saytzeff-s-rul',
    question: 'Saytzeff’s rule predicts that elimination will give mainly',
    options: [
      'the least substituted alkene',
      'the more substituted and more stable alkene',
      'an alkyne',
      'an alcohol',
    ],
    answer: 1,
    explain: 'More alkyl substituents on the double bond mean greater stability through hyperconjugation. A bulky base can override this and give the less substituted product instead — the Hofmann outcome.',
  },
  {
    topicId: 'c12-haloalkanes-haloarenes-why-haloarenes-resist-nucleophilic-subst',
    question: 'Chlorobenzene is far less reactive than chloroethane towards nucleophilic substitution because',
    options: [
      'the C–Cl bond gains partial double bond character through resonance, and the carbon is sp²',
      'chlorine is more electronegative in chlorobenzene',
      'benzene is a saturated molecule',
      'chlorobenzene is a liquid',
    ],
    answer: 0,
    explain: 'Delocalisation of a chlorine lone pair into the ring shortens and strengthens the C–Cl bond, and the sp² carbon holds it more tightly. The ring’s electron density also repels incoming nucleophiles.',
  },

  // ------------------------------------------ Chemistry 12 · Alcohols, Phenols & Ethers
  {
    topicId: 'c12-alcohols-phenols-ethers-preparation-and-physical-properties',
    question: 'Alcohols boil at much higher temperatures than ethers of similar molar mass because',
    options: [
      'alcohols are heavier molecules',
      'alcohols form intermolecular hydrogen bonds',
      'ethers are ionic compounds',
      'alcohols are more branched',
    ],
    answer: 1,
    explain: 'The –OH hydrogen bonds to a neighbouring molecule, and breaking that network costs energy. An ether has no O–H, so it cannot donate a hydrogen bond, only accept one.',
  },
  {
    topicId: 'c12-alcohols-phenols-ethers-acidity-of-alcohols-and-phenols',
    question: 'Phenol is considerably more acidic than ethanol because',
    options: [
      'phenol contains more carbon atoms',
      'the phenoxide ion is stabilised by resonance with the ring',
      'phenol is aromatic and aromatic compounds are always acidic',
      'ethanol is a gas at room temperature',
    ],
    answer: 1,
    explain: 'The negative charge on phenoxide spreads into the ring, whereas ethoxide must carry it entirely on oxygen. Electron-withdrawing groups such as –NO₂ push phenol’s acidity higher still.',
  },
  {
    topicId: 'c12-alcohols-phenols-ethers-reactions-of-alcohols-dehydration-and-ox',
    question: 'The ease of acid-catalysed dehydration of alcohols to alkenes follows the order',
    options: [
      'primary > secondary > tertiary',
      'tertiary > secondary > primary',
      'all react equally readily',
      'secondary > tertiary > primary',
    ],
    answer: 1,
    explain: 'Dehydration goes through a carbocation, and tertiary carbocations are the most stable. The same ordering explains why tertiary alcohols also favour SN1 substitution.',
  },
  {
    topicId: 'c12-alcohols-phenols-ethers-reactions-of-phenols-and-their-distingui',
    question: 'Phenol gives a characteristic violet colouration with',
    options: ['Fehling’s solution', 'neutral FeCl₃', 'Tollens’ reagent', 'sodium bicarbonate'],
    answer: 1,
    explain: 'Neutral ferric chloride is the standard phenol test. Note phenol does NOT liberate CO₂ from sodium bicarbonate, which is precisely how you separate a phenol from a carboxylic acid.',
  },
  {
    topicId: 'c12-alcohols-phenols-ethers-ethers-preparation-and-cleavage',
    question: 'Cleavage of methyl tert-butyl ether by HI gives',
    options: [
      'methyl iodide and tert-butyl alcohol',
      'tert-butyl iodide and methanol',
      'both iodides in equal amounts',
      'no reaction',
    ],
    answer: 1,
    explain: 'A tertiary group leaves as a stable carbocation, so the reaction goes SN1 and the iodide ends up on the tertiary carbon. For ethers with only primary or secondary groups the mechanism is SN2 and the iodide attacks the less hindered side instead.',
  },

  // ------------------------------------------------------------ Chemistry 12 · Amines
  {
    topicId: 'c12-amines-classification-preparation-and-basicity',
    question: 'In aqueous solution, the basicity order of the methylamines is',
    options: [
      '(CH₃)₃N > (CH₃)₂NH > CH₃NH₂',
      '(CH₃)₂NH > CH₃NH₂ > (CH₃)₃N',
      'CH₃NH₂ > (CH₃)₂NH > (CH₃)₃N',
      'all three are equally basic',
    ],
    answer: 1,
    explain: 'Two competing effects: alkyl groups push electron density onto nitrogen, but they also block solvation of the protonated ion and crowd the lone pair. The secondary amine is the best compromise. In the gas phase, with no solvent, the order becomes simply 3° > 2° > 1°.',
  },
  {
    topicId: 'c12-amines-reactions-of-amines-and-the-hinsberg-tes',
    question: 'The Hinsberg test is used to distinguish between',
    options: [
      'aldehydes and ketones',
      'primary, secondary and tertiary amines',
      'alcohols and phenols',
      'acids and esters',
    ],
    answer: 1,
    explain: 'Benzenesulphonyl chloride gives a product soluble in alkali with a primary amine, insoluble with a secondary amine, and no reaction at all with a tertiary amine — three distinct outcomes from one reagent.',
  },
  {
    topicId: 'c12-amines-diazonium-salts-and-their-conversions',
    question: 'Benzenediazonium chloride is prepared from aniline using',
    options: ['concentrated HNO₃', 'NaNO₂ with HCl at 0–5 °C', 'ammonia', 'bromine water'],
    answer: 1,
    explain: 'Nitrous acid is generated in situ, and the low temperature is essential because diazonium salts decompose above about 5 °C. They are enormously useful because the –N₂⁺ group can be swapped for OH, CN, halogen or H.',
  },

  // ------------------------------------------------------- Chemistry 12 · Biomolecules
  {
    topicId: 'c12-biomolecules-carbohydrates-classification-and-structu',
    question: 'Sucrose is a non-reducing sugar because',
    options: [
      'it contains no hydroxyl groups',
      'both anomeric carbons are locked in the glycosidic linkage',
      'it is a monosaccharide',
      'it is insoluble in water',
    ],
    answer: 1,
    explain: 'With no free anomeric carbon there is no open-chain aldehyde or ketone to be oxidised, so Tollens’ and Fehling’s stay negative. Maltose and lactose keep one free anomeric carbon and therefore do reduce.',
  },
  {
    topicId: 'c12-biomolecules-amino-acids-the-peptide-bond-and-protein',
    question: 'The peptide bond in a protein is',
    options: [
      'an ester linkage',
      'an amide linkage between a –COOH and an –NH₂ group',
      'a glycosidic linkage',
      'a disulphide bridge',
    ],
    answer: 1,
    explain: 'It forms with loss of water between the carboxyl of one amino acid and the amino group of the next. Secondary structure — the α-helix and β-pleated sheet — is then held together by hydrogen bonds, not peptide bonds.',
  },
  {
    topicId: 'c12-biomolecules-nucleic-acids-enzymes-and-vitamins',
    question: 'Vitamin C must be supplied in the diet regularly because it is',
    options: [
      'fat soluble and stored in the liver',
      'water soluble, so it is excreted and not stored',
      'synthesised by the human body',
      'a protein that degrades quickly',
    ],
    answer: 1,
    explain: 'Vitamins B and C are water soluble and are lost in urine, so they need constant replenishment. A, D, E and K are fat soluble and stored, which is why those can build up to toxic levels.',
  },

  // ------------------------------------- Chemistry 12 · The p-Block Elements (15-18)
  {
    topicId: 'c12-the-p-block-elements-groups-15-18-group-15-trends-ammonia-and-nitric-acid',
    question: 'The basicity of the group 15 hydrides follows the order',
    options: [
      'NH₃ > PH₃ > AsH₃ > SbH₃',
      'SbH₃ > AsH₃ > PH₃ > NH₃',
      'PH₃ > NH₃ > AsH₃ > SbH₃',
      'all are equally basic',
    ],
    answer: 0,
    explain: 'Going down the group the central atom grows, so the lone pair is spread over a larger volume and is less available for donation. The same size trend makes the hydrides progressively less thermally stable.',
  },
  {
    topicId: 'c12-the-p-block-elements-groups-15-18-group-16-trends-oxygen-and-sulphuric-aci',
    question: 'Among H₂O, H₂S, H₂Se and H₂Te, the strongest reducing agent is',
    options: ['H₂O', 'H₂S', 'H₂Se', 'H₂Te'],
    answer: 3,
    explain: 'The H–E bond weakens down the group, so H₂Te gives up hydrogen most readily. Water is the odd one out on boiling point too, because of hydrogen bonding.',
  },
  {
    topicId: 'c12-the-p-block-elements-groups-15-18-group-17-halogens-and-group-18-noble-gas',
    question: 'Fluorine has a LESS negative electron gain enthalpy than chlorine because',
    options: [
      'fluorine is less electronegative than chlorine',
      'strong electron–electron repulsion in its small compact 2p subshell',
      'fluorine exists as a gas',
      'chlorine has a larger nuclear charge',
    ],
    answer: 1,
    explain: 'The incoming electron is crowded into a very small orbital already dense with electrons. Fluorine remains the most electronegative element — electronegativity and electron gain enthalpy are different properties, and this is the classic case where they disagree.',
  },

  // --------------------------------------- Chemistry 12 · Coordination Compounds
  {
    topicId: 'c12-coordination-compounds-iupac-nomenclature-of-complexes',
    question: 'The IUPAC name of K₃[Fe(CN)₆] is',
    options: [
      'potassium hexacyanidoferrate(II)',
      'potassium hexacyanidoferrate(III)',
      'tripotassium hexacyanoiron(III)',
      'potassium ferricyanide',
    ],
    answer: 1,
    explain: 'Three K⁺ against a 3− complex ion means Fe is +3. An anionic complex takes the -ate suffix on the Latin stem: ferrate(III).',
  },
  {
    topicId: 'c12-coordination-compounds-oxidation-state-coordination-number-and-',
    question: 'The oxidation state of cobalt in [Co(NH₃)₅Cl]Cl₂ is',
    options: ['+1', '+2', '+3', '+4'],
    answer: 2,
    explain: 'Two chlorides outside make the complex ion 2+. Inside, five neutral NH₃ and one Cl⁻ give x − 1 = +2, so x = +3.',
  },
  {
    topicId: 'c12-coordination-compounds-crystal-field-theory-splitting-in-octahe',
    question: 'For the same metal and ligands, the tetrahedral splitting Δt is approximately',
    options: ['equal to Δo', '(4/9)Δo', '(9/4)Δo', '(2/3)Δo'],
    answer: 1,
    explain: 'Fewer ligands and no head-on approach give Δt ≈ (4/9)Δo — too small to force pairing, which is why tetrahedral complexes are always high spin.',
  },
  {
    topicId: 'c12-coordination-compounds-spectrochemical-series-high-spin-vs-low-',
    question: 'Which ligand produces the largest crystal field splitting?',
    options: ['I⁻', 'H₂O', 'NH₃', 'CN⁻'],
    answer: 3,
    explain: 'Order runs I⁻ < Br⁻ < Cl⁻ < F⁻ < OH⁻ < H₂O < NH₃ < en < NO₂⁻ < CN⁻ < CO. CN⁻ is near the strong-field end.',
  },
  {
    topicId: 'c12-coordination-compounds-magnetic-moment-from-unpaired-electrons',
    question: 'The spin-only magnetic moment of [Fe(CN)₆]³⁻ is',
    options: ['1.73 BM', '3.87 BM', '5.92 BM', '0 BM'],
    answer: 0,
    explain: 'Fe³⁺ is d⁵; CN⁻ is strong field, so t₂g⁵ leaves one unpaired electron. μ = √(1×3) = 1.73 BM.',
  },
  {
    topicId: 'c12-coordination-compounds-counting-isomers-geometrical-optical-and',
    question: 'The number of geometrical isomers of [Co(NH₃)₄Cl₂]⁺ is',
    options: ['1', '2', '3', '4'],
    answer: 1,
    explain: 'An octahedral Ma₄b₂ gives exactly two: cis and trans.',
  },
  {
    topicId: 'c12-coordination-compounds-vbt-hybridisation-and-predicting-geometr',
    question: '[Ni(CN)₄]²⁻ is',
    options: [
      'sp³, tetrahedral, paramagnetic',
      'dsp², square planar, diamagnetic',
      'sp³d², octahedral, paramagnetic',
      'dsp², square planar, paramagnetic',
    ],
    answer: 1,
    explain: 'Strong-field CN⁻ pairs the d⁸ electrons, freeing a 3d orbital for dsp² — square planar and diamagnetic. Contrast [NiCl₄]²⁻, which is tetrahedral and paramagnetic.',
  },

  // ================================================================== CLASS 11 MATHS
  // ------------------------------- Maths 11 · Complex Numbers & Quadratic Equations
  {
    topicId: 'm11-complex-numbers-quadratic-equations-algebra-of-complex-numbers-modulus-and-c',
    question: 'For a complex number z, the product z·z̄ equals',
    options: ['|z|', '|z|²', 'z²', '2 Re(z)'],
    answer: 1,
    explain: 'z·z̄ = a² + b² = |z|², always real and non-negative. This is exactly what lets you rationalise a denominator by multiplying by the conjugate.',
  },
  {
    topicId: 'm11-complex-numbers-quadratic-equations-argand-plane-polar-form-and-argument',
    question: 'In the Argand plane, |z − z₁| = r represents',
    options: [
      'a straight line through z₁',
      'a circle of radius r centred at z₁',
      'an ellipse with focus z₁',
      'a single point',
    ],
    answer: 1,
    explain: 'A modulus is a distance, so the locus of points a fixed distance r from z₁ is a circle. By contrast |z − z₁| = |z − z₂| gives the perpendicular bisector of the segment joining them.',
  },
  {
    topicId: 'm11-complex-numbers-quadratic-equations-de-moivre-s-theorem-and-roots-of-unity',
    question: 'The n distinct nth roots of unity, plotted in the Argand plane, lie',
    options: [
      'on a straight line',
      'at the vertices of a regular n-sided polygon on the unit circle',
      'all at one point',
      'on a circle of radius n',
    ],
    answer: 1,
    explain: 'Each has modulus 1, with arguments spaced 2π/n apart. Their sum is therefore zero for every n > 1.',
  },
  {
    topicId: 'm11-complex-numbers-quadratic-equations-nature-of-roots-and-the-discriminant',
    question: 'A quadratic with real coefficients and discriminant D < 0 has',
    options: [
      'two distinct real roots',
      'a pair of complex conjugate roots',
      'one repeated real root',
      'no roots at all',
    ],
    answer: 1,
    explain: 'Complex roots of a real-coefficient polynomial always come in conjugate pairs — you can never have just one. D = 0 gives equal real roots, D > 0 two distinct real ones.',
  },
  {
    topicId: 'm11-complex-numbers-quadratic-equations-relation-between-roots-and-coefficients',
    question: 'For ax² + bx + c = 0, the sum and the product of the roots are respectively',
    options: ['−b/a and c/a', 'b/a and −c/a', '−c/a and b/a', 'b/a and c/a'],
    answer: 0,
    explain: 'Sum = −b/a, product = c/a. The minus sign is the usual casualty. These let you construct a new quadratic from transformed roots without ever solving the original.',
  },

  // --------------------------------------------------- Maths 11 · Sequences & Series
  {
    topicId: 'm11-sequences-series-arithmetic-progression-nth-term-and-sum',
    question: 'What characterises an arithmetic progression is that consecutive terms differ by',
    options: ['a constant amount', 'an increasing amount', 'a constant ratio', 'a positive amount'],
    answer: 0,
    explain: 'A constant common difference d defines an AP, and d may be negative or zero. A constant RATIO would make it a geometric progression instead.',
  },
  {
    topicId: 'm11-sequences-series-geometric-progression-and-the-infinite-g',
    question: 'An infinite geometric series has a finite sum precisely when',
    options: ['|r| > 1', '|r| < 1', 'r = 1', 'r is an integer'],
    answer: 1,
    explain: 'Only then do the terms shrink fast enough, giving S∞ = a/(1 − r). For |r| ≥ 1 the series diverges.',
  },
  {
    topicId: 'm11-sequences-series-arithmetic-geometric-and-harmonic-means',
    question: 'For two distinct positive numbers, the arithmetic, geometric and harmonic means satisfy',
    options: ['AM < GM < HM', 'AM > GM > HM', 'AM = GM = HM', 'GM > AM > HM'],
    answer: 1,
    explain: 'AM ≥ GM ≥ HM always, with equality only when the numbers are equal. It is also true that GM² = AM × HM.',
  },
  {
    topicId: 'm11-sequences-series-special-series-and-summation-techniques',
    question: 'The sum of the first n natural numbers is',
    options: ['n(n + 1)/2', 'n(n + 1)(2n + 1)/6', '[n(n + 1)/2]²', 'n²'],
    answer: 0,
    explain: 'Σn = n(n+1)/2. The second option is Σn² and the third is Σn³, which happens to be the square of Σn.',
  },

  // ----------------------------------------------------- Maths 11 · Binomial Theorem
  {
    topicId: 'm11-binomial-theorem-binomial-expansion-and-the-general-term',
    question: 'The expansion of (a + b)ⁿ for a positive integer n contains',
    options: ['n terms', 'n + 1 terms', '2n terms', 'infinitely many terms'],
    answer: 1,
    explain: 'The exponent of b runs from 0 to n. The general term is T_{r+1} = ⁿC_r a^{n−r} b^r — note the index shift, which is where most errors begin.',
  },
  {
    topicId: 'm11-binomial-theorem-middle-term-and-the-term-independent-of-',
    question: 'In the expansion of (a + b)ⁿ with n even, the number of middle terms is',
    options: ['one', 'two', 'n/2', 'none'],
    answer: 0,
    explain: 'An even n gives an odd number of terms, so there is exactly one middle term, the (n/2 + 1)th. An ODD n gives two middle terms.',
  },
  {
    topicId: 'm11-binomial-theorem-properties-of-binomial-coefficients',
    question: 'The sum of all binomial coefficients in the expansion of (1 + x)ⁿ is',
    options: ['2ⁿ', 'n²', '2ⁿ⁻¹', 'n!'],
    answer: 0,
    explain: 'Putting x = 1 gives Σ ⁿC_r = 2ⁿ. Putting x = −1 shows the alternating sum is zero, so the odd and even coefficients each total 2ⁿ⁻¹.',
  },

  // --------------------------------------------------- Maths 11 · Limits & Derivatives
  {
    topicId: 'm11-limits-derivatives-the-idea-of-a-limit-and-one-sided-limits',
    question: 'The limit of f(x) as x → a exists if and only if',
    options: [
      'f(a) is defined',
      'the left-hand and right-hand limits both exist and are equal',
      'f is continuous at a',
      'f is differentiable at a',
    ],
    answer: 1,
    explain: 'A limit describes the approach to a, not the value at a — f need not even be defined there. Continuity additionally demands that the limit equal f(a).',
  },
  {
    topicId: 'm11-limits-derivatives-standard-limits-and-indeterminate-forms',
    question: 'When a limit produces the form 0/0, this means the limit is',
    options: [
      'equal to zero',
      'indeterminate, so more work is needed to evaluate it',
      'equal to 1',
      'guaranteed not to exist',
    ],
    answer: 1,
    explain: 'Indeterminate means the form alone settles nothing — the limit may take any value or fail to exist. Factorising, rationalising, or a standard limit such as (sin x)/x → 1 resolves it.',
  },
  {
    topicId: 'm11-limits-derivatives-derivative-from-first-principles',
    question: 'From first principles, the derivative of f at x is the limit of',
    options: [
      '[f(x + h) − f(x)]/h as h → 0',
      '[f(x + h) − f(x)]/h as x → 0',
      '[f(x) − f(0)]/x as x → 0',
      'f(x + h) − f(x) as h → 0',
    ],
    answer: 0,
    explain: 'It is the limiting slope of a chord as h shrinks to zero. Omitting the division by h leaves only zero — the standard slip.',
  },
  {
    topicId: 'm11-limits-derivatives-rules-of-differentiation',
    question: 'The product rule gives d(uv)/dx as',
    options: ['u′v′', 'u′v + uv′', 'u′v − uv′', '(u′v − uv′)/v²'],
    answer: 1,
    explain: 'Multiplying the two derivatives is never correct. The last option is the quotient rule, which subtracts and divides by v².',
  },

  // ------------------------------------------- Maths 11 · Permutations & Combinations
  {
    topicId: 'm11-permutations-combinations-the-fundamental-principle-of-counting',
    question: 'If one task can be done in m ways and then, independently, a second in n ways, the number of ways to do both is',
    options: ['m + n', 'm × n', 'm − n', 'mⁿ'],
    answer: 1,
    explain: 'Tasks done together multiply; mutually exclusive alternatives add. Deciding whether a problem is an AND or an OR is most of the battle in counting.',
  },
  {
    topicId: 'm11-permutations-combinations-permutations-with-repetition-and-with-re',
    question: 'A permutation differs from a combination in that a permutation',
    options: [
      'ignores the order of selection',
      'takes the order of arrangement into account',
      'always allows repetition',
      'applies only to identical objects',
    ],
    answer: 1,
    explain: 'Order matters for permutations and not for combinations, which is why ⁿP_r = ⁿC_r × r!. Words and seating are permutations; teams and handshakes are combinations.',
  },
  {
    topicId: 'm11-permutations-combinations-combinations-and-when-order-does-not-mat',
    question: 'The value of ⁿC_r is equal to',
    options: ['ⁿC_{n−r}', 'ⁿP_r', 'ⁿC_{r−1}', 'n!/r!'],
    answer: 0,
    explain: 'Choosing r to include is the same as choosing n − r to leave out. This symmetry turns a heavy computation such as ¹⁰⁰C₉₈ into a trivial one.',
  },
  {
    topicId: 'm11-permutations-combinations-circular-arrangements-and-identical-obje',
    question: 'The number of ways to seat n distinct people around a circular table is',
    options: ['n!', '(n − 1)!', 'n!/2', '(n − 1)!/2'],
    answer: 1,
    explain: 'Only relative position matters, so fix one person and arrange the rest. If the arrangement can also be flipped over, as with a necklace, divide by 2 again.',
  },

  // --------------------------------------------------------- Maths 11 · Probability
  {
    topicId: 'm11-probability-random-experiments-sample-space-and-even',
    question: 'The sample space of a random experiment is',
    options: [
      'the set of favourable outcomes only',
      'the set of all possible outcomes',
      'a single outcome',
      'always a finite set',
    ],
    answer: 1,
    explain: 'It contains every possible outcome, and an event is any subset of it. Sample spaces may be infinite — for instance tossing until the first head appears.',
  },
  {
    topicId: 'm11-probability-axiomatic-probability-and-the-addition-r',
    question: 'For any two events A and B, P(A ∪ B) equals',
    options: ['P(A) + P(B)', 'P(A) + P(B) − P(A ∩ B)', 'P(A)·P(B)', 'P(A) − P(B)'],
    answer: 1,
    explain: 'The overlap would otherwise be counted twice. The plain sum is correct only when the events are mutually exclusive.',
  },
  {
    topicId: 'm11-probability-mutually-exclusive-and-exhaustive-events',
    question: 'Two events are mutually exclusive when',
    options: [
      'they cannot occur together, so P(A ∩ B) = 0',
      'they are independent of each other',
      'they have equal probabilities',
      'their union has probability 1',
    ],
    answer: 0,
    explain: 'Mutually exclusive means disjoint. Exhaustive is a different idea — the events together cover the whole sample space. And mutually exclusive is not the same as independent.',
  },

  // ---------------------------------------------------------- Maths 11 · Statistics
  {
    topicId: 'm11-statistics-measures-of-central-tendency',
    question: 'The measure of central tendency least disturbed by a few extreme values is the',
    options: ['mean', 'median', 'range', 'standard deviation'],
    answer: 1,
    explain: 'The median depends only on position, so outliers barely move it. The mean gets dragged towards extremes — which is why median income is reported rather than mean income.',
  },
  {
    topicId: 'm11-statistics-mean-deviation-variance-and-standard-dev',
    question: 'Variance squares the deviations from the mean rather than using them directly because',
    options: [
      'squares are easier to compute',
      'the plain deviations from the mean always sum to zero',
      'squaring makes the value smaller',
      'it keeps the original units',
    ],
    answer: 1,
    explain: 'Σ(x − x̄) is identically zero, so it measures nothing at all. Squaring removes the cancellation; taking the square root afterwards restores the original units, which is why standard deviation is the quoted figure.',
  },
  {
    topicId: 'm11-statistics-comparing-dispersion-with-the-coefficien',
    question: 'To compare the variability of two data sets measured in different units, use the',
    options: ['variance', 'standard deviation', 'coefficient of variation', 'mean deviation'],
    answer: 2,
    explain: 'CV = (σ/x̄) × 100 is a pure ratio, so it carries no units and allows fair comparison. A larger CV means greater relative variability, hence less consistency.',
  },

  // ------------------------------------------------------- Maths 11 · Straight Lines
  {
    topicId: 'm11-straight-lines-slope-and-the-forms-of-the-equation-of-a',
    question: 'The slope of a line parallel to the y-axis is',
    options: ['0', '1', 'undefined', '−1'],
    answer: 2,
    explain: 'A vertical line rises infinitely for zero run, so tan 90° is undefined and its equation takes the form x = k. A horizontal line has slope 0 instead.',
  },
  {
    topicId: 'm11-straight-lines-angle-between-lines-parallel-and-perpend',
    question: 'Two lines of slopes m₁ and m₂ are perpendicular when',
    options: ['m₁ = m₂', 'm₁·m₂ = −1', 'm₁ + m₂ = 0', 'm₁·m₂ = 1'],
    answer: 1,
    explain: 'Equal slopes mean parallel; a product of −1 means perpendicular. The test breaks down when one line is vertical, since its slope is undefined — handle that case separately.',
  },
  {
    topicId: 'm11-straight-lines-distance-of-a-point-from-a-line',
    question: 'The distance from a point to a line is measured along',
    options: [
      'the horizontal direction',
      'the perpendicular dropped from the point to the line',
      'any convenient direction',
      'the line joining the point to the origin',
    ],
    answer: 1,
    explain: 'Distance always means the shortest path, which is the perpendicular. Hence |ax₁ + by₁ + c|/√(a² + b²), with a modulus because distance is never negative.',
  },

  // -------------------------------------------- Maths 11 · Trigonometric Functions
  {
    topicId: 'm11-trigonometric-functions-trigonometric-ratios-signs-and-periodici',
    question: 'In the second quadrant, which trigonometric ratios are positive?',
    options: ['all of them', 'sine and cosecant only', 'tangent and cotangent only', 'cosine and secant only'],
    answer: 1,
    explain: 'The ASTC rule: All positive in the first quadrant, Sine in the second, Tangent in the third, Cosine in the fourth — each together with its reciprocal.',
  },
  {
    topicId: 'm11-trigonometric-functions-identities-and-transformation-formulae',
    question: 'The identity sin²θ + cos²θ = 1 holds',
    options: [
      'only for acute angles',
      'for every real value of θ',
      'only in the first quadrant',
      'only when θ is measured in degrees',
    ],
    answer: 1,
    explain: 'It follows directly from the unit circle, so it is valid for all real θ. The companions 1 + tan²θ = sec²θ and 1 + cot²θ = cosec²θ hold wherever those functions are defined.',
  },
  {
    topicId: 'm11-trigonometric-functions-general-solutions-of-trigonometric-equat',
    question: 'The general solution of sin θ = 0 is',
    options: ['θ = nπ', 'θ = (2n + 1)π/2', 'θ = 2nπ', 'θ = nπ/2'],
    answer: 0,
    explain: 'Sine vanishes at every integer multiple of π, while cos θ = 0 gives the odd multiples of π/2. Because these functions are periodic, a general solution must capture every value, not just the principal one.',
  },
  {
    topicId: 'm11-trigonometric-functions-sine-rule-and-cosine-rule',
    question: 'The cosine rule is the right tool when you are given',
    options: [
      'two angles and one side',
      'two sides and the angle between them',
      'three angles',
      'one side and one angle only',
    ],
    answer: 1,
    explain: 'The cosine rule handles two sides with the included angle, or all three sides. The sine rule suits two angles with a side. Three angles alone never fix a triangle’s size.',
  },

  // ----------------------------------------------- Maths 11 · Relations & Functions
  {
    topicId: 'm11-relations-functions-cartesian-product-and-relations',
    question: 'If set A has m elements and set B has n elements, the number of relations from A to B is',
    options: ['mn', '2^{mn}', 'm^n', 'm + n'],
    answer: 1,
    explain: 'A × B contains mn ordered pairs, and a relation is any subset of it, giving 2^{mn}. Functions form a much smaller family, numbering n^m.',
  },
  {
    topicId: 'm11-relations-functions-domain-codomain-and-range',
    question: 'The range of a function is',
    options: [
      'identical to its codomain',
      'the set of values actually attained, which is a subset of the codomain',
      'the set of all inputs',
      'always the whole real line',
    ],
    answer: 1,
    explain: 'The codomain is declared in advance; the range is what the function genuinely produces. The two coincide exactly when the function is onto.',
  },
  {
    topicId: 'm11-relations-functions-standard-functions-and-their-graphs',
    question: 'A curve in the plane represents y as a function of x if',
    options: [
      'it passes through the origin',
      'no vertical line meets it more than once',
      'no horizontal line meets it more than once',
      'it is continuous everywhere',
    ],
    answer: 1,
    explain: 'This is the vertical line test: each input must yield exactly one output. The HORIZONTAL line test is a different check — it tells you whether the function is one-one.',
  },

  // -------------------------------------------------------------- Maths 11 · Sets
  {
    topicId: 'm11-sets-set-operations-and-venn-diagrams',
    question: 'For any two finite sets, n(A ∪ B) equals',
    options: ['n(A) + n(B)', 'n(A) + n(B) − n(A ∩ B)', 'n(A) × n(B)', 'n(A) − n(B)'],
    answer: 1,
    explain: 'Elements lying in both sets would otherwise be counted twice. The simple sum is right only for disjoint sets, where the intersection is empty.',
  },
  {
    topicId: 'm11-sets-subsets-power-set-and-cardinality',
    question: 'A set with n elements has how many subsets?',
    options: ['n', '2ⁿ', 'n²', 'n!'],
    answer: 1,
    explain: 'Each element is independently either in or out, giving 2ⁿ — counting both the empty set and the set itself. The number of PROPER subsets is 2ⁿ − 1.',
  },
  {
    topicId: 'm11-sets-complement-and-de-morgan-s-laws',
    question: 'De Morgan’s law says that (A ∪ B)′ equals',
    options: ['A′ ∪ B′', 'A′ ∩ B′', 'A ∩ B', '(A ∩ B)′'],
    answer: 1,
    explain: 'Complementing a union gives the intersection of the complements — the operation flips. Being in neither set means being outside both.',
  },

  // --------------------------------------- Maths 11 · Introduction to 3D Geometry
  {
    topicId: 'm11-introduction-to-3d-geometry-coordinates-in-space-and-the-octants',
    question: 'The three coordinate planes divide space into how many octants?',
    options: ['4', '6', '8', '12'],
    answer: 2,
    explain: 'Each coordinate may independently be positive or negative, giving 2³ = 8 regions. The same reasoning in two dimensions produces 4 quadrants.',
  },
  {
    topicId: 'm11-introduction-to-3d-geometry-distance-and-section-formulae-in-three-d',
    question: 'A point lying on the x-axis in three dimensions has coordinates of the form',
    options: ['(x, y, 0)', '(x, 0, 0)', '(0, y, z)', '(x, x, x)'],
    answer: 1,
    explain: 'On an axis the other two coordinates vanish. Points of the form (x, y, 0) lie in the xy-PLANE, which is a weaker condition — this is the usual confusion.',
  },

  // -------------------------------------------------- Maths 11 · Linear Inequalities
  {
    topicId: 'm11-linear-inequalities-solving-linear-inequalities-in-one-varia',
    question: 'When both sides of an inequality are multiplied by a negative number, the inequality sign',
    options: ['stays the same', 'reverses', 'becomes an equality', 'becomes undefined'],
    answer: 1,
    explain: 'Multiplying or dividing by a negative reverses the direction. Forgetting this is the commonest error in the chapter, and it silently yields exactly the complement of the right answer.',
  },
  {
    topicId: 'm11-linear-inequalities-graphical-solution-in-two-variables',
    question: 'The solution set of a linear inequality in two variables is',
    options: [
      'a single point',
      'a half-plane on one side of the boundary line',
      'the boundary line only',
      'the entire plane',
    ],
    answer: 1,
    explain: 'The line splits the plane in two; testing a convenient point such as the origin identifies the correct half. A strict inequality excludes the line itself, drawn dashed.',
  },

  // ------------------------------------------------------ Maths 11 · Conic Sections
  {
    topicId: 'm11-conic-sections-circle-equation-tangent-and-chord-of-con',
    question: 'The general equation x² + y² + 2gx + 2fy + c = 0 represents a real circle only when',
    options: ['g² + f² − c > 0', 'g² + f² − c < 0', 'c > 0', 'g = f'],
    answer: 0,
    explain: 'The radius is √(g² + f² − c), so the expression must be positive. Zero gives a point circle and a negative value gives an imaginary one.',
  },
  {
    topicId: 'm11-conic-sections-parabola-standard-form-focus-directrix-l',
    question: 'For the parabola y² = 4ax, the length of the latus rectum is',
    options: ['a', '2a', '4a', 'a/4'],
    answer: 2,
    explain: 'The latus rectum is 4a, with focus at (a, 0) and directrix x = −a. A parabola has eccentricity exactly 1, so every point is equidistant from focus and directrix.',
  },
  {
    topicId: 'm11-conic-sections-ellipse-eccentricity-foci-and-the-b-a-ca',
    question: 'For the ellipse x²/a² + y²/b² = 1 with a > b, the eccentricity satisfies',
    options: ['e² = 1 − b²/a²', 'e² = 1 + b²/a²', 'e² = b²/a² − 1', 'e = 1'],
    answer: 0,
    explain: 'An ellipse has e < 1, so the term subtracts. If b > a instead, the major axis runs along y and the foci move to (0, ±be) — always compare a and b before writing anything down.',
  },
  {
    topicId: 'm11-conic-sections-hyperbola-eccentricity-asymptotes-conjug',
    question: 'For the hyperbola x²/a² − y²/b² = 1, the eccentricity satisfies',
    options: ['e² = 1 − b²/a²', 'e² = 1 + b²/a²', 'e < 1', 'e = 1'],
    answer: 1,
    explain: 'A hyperbola has e > 1, so the term adds — the sign flip from the ellipse is the classic slip. Its asymptotes are y = ±(b/a)x.',
  },
  {
    topicId: 'm11-conic-sections-tangent-and-normal-conditions-across-all',
    question: 'The line y = mx + c is a tangent to the parabola y² = 4ax when',
    options: ['c = a/m', 'c = am', 'c = a + m', 'c = 4am'],
    answer: 0,
    explain: 'Substituting and forcing the discriminant to zero gives c = a/m. The corresponding tangency condition for the ellipse is c² = a²m² + b².',
  },
  {
    topicId: 'm11-conic-sections-reducing-a-general-second-degree-equatio',
    question: 'Before identifying the centre and axes of a shifted conic, the necessary first step is to',
    options: [
      'differentiate the equation',
      'complete the square in x and in y',
      'set the equation equal to zero',
      'substitute x = 0',
    ],
    answer: 1,
    explain: 'Completing the square converts the general form to the standard one and reveals the shift. Reading a and b straight off the raw equation is the standard way to get every subsequent step wrong.',
  },

  // ------------------------------------- Maths 12 · Continuity & Differentiability
  {
    topicId: 'm12-continuity-differentiability-continuity-at-a-point-and-classifying-di',
    question: 'A function f is continuous at x = a precisely when',
    options: [
      'f(a) is defined',
      'the limit of f as x → a exists',
      'f(a) is defined, the limit exists, and the two are equal',
      'f is differentiable at a',
    ],
    answer: 2,
    explain: 'All three conditions must hold together. A removable discontinuity satisfies the first two but fails the third — the limit exists yet does not match the value.',
  },
  {
    topicId: 'm12-continuity-differentiability-differentiability-and-why-it-implies-con',
    question: 'At x = 0, the function f(x) = |x| is',
    options: [
      'continuous and differentiable',
      'continuous but not differentiable',
      'differentiable but not continuous',
      'neither continuous nor differentiable',
    ],
    answer: 1,
    explain: 'The left and right derivatives are −1 and +1, so no unique tangent exists at the corner. This is the standard counterexample: differentiability implies continuity, never the reverse.',
  },
  {
    topicId: 'm12-continuity-differentiability-chain-rule-on-nested-and-composite-funct',
    question: 'The chain rule is the tool for differentiating',
    options: ['a sum of functions', 'a composite function', 'a product of functions', 'a constant'],
    answer: 1,
    explain: 'For f(g(x)) the derivative is f′(g(x))·g′(x). Products need the product rule and quotients the quotient rule — reaching for the wrong one is the usual slip.',
  },
  {
    topicId: 'm12-continuity-differentiability-implicit-and-parametric-differentiation',
    question: 'For a curve given parametrically by x = f(t) and y = g(t), dy/dx equals',
    options: ['g′(t)/f′(t)', 'f′(t)/g′(t)', 'g′(t)·f′(t)', 'g″(t)/f″(t)'],
    answer: 0,
    explain: 'dy/dx = (dy/dt)/(dx/dt). Inverting this fraction is the common error. Note that d²y/dx² is NOT g″/f″ — it requires differentiating dy/dx again with respect to t and dividing by dx/dt.',
  },
  {
    topicId: 'm12-continuity-differentiability-logarithmic-differentiation',
    question: 'Logarithmic differentiation is the natural method when the function has the form',
    options: ['a polynomial', '[f(x)]^{g(x)}', 'a constant', 'a sum of two terms'],
    answer: 1,
    explain: 'With a variable in both base and exponent, neither the power rule nor the exponential rule applies. Taking logs first turns the exponent into a product.',
  },
  {
    topicId: 'm12-continuity-differentiability-rolle-s-and-lagrange-s-mean-value-theore',
    question: 'Beyond continuity on [a, b] and differentiability on (a, b), Rolle’s theorem additionally requires that',
    options: ['f(a) = f(b)', 'f(a) = 0', 'f is increasing', 'f is a polynomial'],
    answer: 0,
    explain: 'Equal endpoint values guarantee some c with f′(c) = 0. Lagrange’s mean value theorem drops that requirement and concludes f′(c) = (f(b) − f(a))/(b − a) instead.',
  },

  // ---------------------------------------------------------- Maths 12 · Integrals
  {
    topicId: 'm12-integrals-standard-integrals-worth-knowing-cold',
    question: '∫ (1/x) dx equals',
    options: ['x⁻² + C', 'ln|x| + C', '1/x² + C', '−1/x² + C'],
    answer: 1,
    explain: 'The modulus matters — the antiderivative is valid on both sides of zero. The power rule x^{n+1}/(n+1) breaks down at n = −1, which is exactly why this case is separate.',
  },
  {
    topicId: 'm12-integrals-integration-by-substitution',
    question: 'When substitution is used on a DEFINITE integral, you must also',
    options: [
      'change the limits to match the new variable',
      'multiply the result by the substitution',
      'differentiate the final answer',
      'add an arbitrary constant',
    ],
    answer: 0,
    explain: 'Either convert the limits along with the variable, or convert back to the original variable before substituting the old limits. Applying old limits to a new variable is the classic error, and no constant is needed for a definite integral.',
  },
  {
    topicId: 'm12-integrals-integration-by-parts-and-the-ilate-order',
    question: 'In ∫ x·eˣ dx, the ILATE rule says the function to take as the first (u) is',
    options: ['eˣ', 'x', 'either, it makes no difference', 'neither'],
    answer: 1,
    explain: 'ILATE orders Inverse, Logarithmic, Algebraic, Trigonometric, Exponential. Algebraic precedes Exponential, so u = x — which is what makes the resulting integral simpler rather than worse.',
  },
  {
    topicId: 'm12-integrals-partial-fractions',
    question: 'Partial fractions apply when the integrand is',
    options: [
      'a product of two unrelated functions',
      'a rational function, that is a ratio of polynomials',
      'a trigonometric function',
      'an exponential function',
    ],
    answer: 1,
    explain: 'The method splits a rational function into simpler fractions. If the numerator’s degree is not lower than the denominator’s, divide first — skipping that step is the usual mistake.',
  },
  {
    topicId: 'm12-integrals-definite-integral-properties-especially-',
    question: 'For an odd function f, the value of ∫ from −a to a of f(x) dx is',
    options: ['2∫₀ᵃ f(x) dx', '0', '∫₀ᵃ f(x) dx', 'undefined'],
    answer: 1,
    explain: 'The contributions on either side of the origin cancel exactly. For an EVEN function the same integral doubles to 2∫₀ᵃ — checking parity first often removes all the work.',
  },
  {
    topicId: 'm12-integrals-definite-integral-as-the-limit-of-a-sum',
    question: 'The "limit of a sum" definition interprets ∫ₐᵇ f(x) dx as',
    options: [
      'the antiderivative evaluated at b minus at a',
      'the limit of a Riemann sum of rectangle areas as the widths tend to zero',
      'the slope of the tangent at b',
      'the average value of f on [a, b]',
    ],
    answer: 1,
    explain: 'This is the definition of the integral. The antiderivative statement is the Fundamental Theorem of Calculus — a powerful theorem connecting the two ideas, not the definition itself.',
  },

  // ------------------------------------------ Maths 12 · Applications of Derivatives
  {
    topicId: 'm12-applications-of-derivatives-rate-of-change-and-related-rates',
    question: 'The derivative dy/dx represents',
    options: [
      'the area under the curve',
      'the instantaneous rate of change of y with respect to x',
      'the average rate of change over an interval',
      'the slope of the normal',
    ],
    answer: 1,
    explain: 'It is the limiting value of Δy/Δx, so it is instantaneous rather than average. Related-rate problems chain these together through a shared variable, usually time.',
  },
  {
    topicId: 'm12-applications-of-derivatives-increasing-and-decreasing-functions',
    question: 'A differentiable function f is strictly increasing on an interval when, throughout it,',
    options: ['f′(x) < 0', 'f′(x) > 0', 'f″(x) > 0', 'f′(x) = 0'],
    answer: 1,
    explain: 'A positive derivative means rising values. f″ > 0 describes concavity, which is a different property — a function can be concave up while decreasing.',
  },
  {
    topicId: 'm12-applications-of-derivatives-tangents-and-normals',
    question: 'If the tangent to a curve at a point has slope m (m ≠ 0), the normal there has slope',
    options: ['m', '−1/m', '1/m', '−m'],
    answer: 1,
    explain: 'The normal is perpendicular to the tangent, and perpendicular slopes multiply to −1. Where the tangent is horizontal the normal is vertical, with undefined slope.',
  },
  {
    topicId: 'm12-applications-of-derivatives-maxima-and-minima-first-and-second-deriv',
    question: 'At a point of local maximum of a twice-differentiable function,',
    options: ['f′ = 0 and f″ > 0', 'f′ = 0 and f″ < 0', 'f′ > 0', 'f″ = 0 only'],
    answer: 1,
    explain: 'A stationary point that curves downward is a maximum. If f″ = 0 the test is inconclusive and you fall back on the sign change of f′ — as with y = x⁴ at the origin.',
  },
  {
    topicId: 'm12-applications-of-derivatives-absolute-extrema-on-a-closed-interval',
    question: 'The absolute maximum of a continuous function on a closed interval [a, b] must occur',
    options: [
      'only at a critical point',
      'at a critical point or at an endpoint',
      'only at an endpoint',
      'always at the midpoint',
    ],
    answer: 1,
    explain: 'Endpoints are genuine candidates even though f′ need not vanish there. Forgetting to evaluate f(a) and f(b) is the single most common way to lose the answer.',
  },

  // ------------------------------------------------------ Maths 12 · Vector Algebra
  {
    topicId: 'm12-vector-algebra-types-of-vectors-and-when-two-vectors-ar',
    question: 'Two vectors are equal when they have',
    options: [
      'the same magnitude',
      'the same magnitude and direction, wherever they are placed',
      'the same initial point',
      'the same direction only',
    ],
    answer: 1,
    explain: 'Free vectors carry no fixed location, so position is irrelevant. Both magnitude and direction must agree — equal magnitudes alone are not enough.',
  },
  {
    topicId: 'm12-vector-algebra-scalar-dot-product-and-its-uses',
    question: 'For two non-zero vectors, a·b = 0 means the vectors are',
    options: ['parallel', 'perpendicular', 'equal', 'antiparallel'],
    answer: 1,
    explain: 'a·b = |a||b|cos θ, which vanishes at θ = 90°. The cross product behaves oppositely: a × b = 0 signals parallel vectors.',
  },
  {
    topicId: 'm12-vector-algebra-vector-cross-product-and-its-uses',
    question: '|a × b| gives',
    options: [
      'the area of the triangle with a and b as two sides',
      'the area of the parallelogram with a and b as adjacent sides',
      'the volume of a parallelepiped',
      'the projection of a on b',
    ],
    answer: 1,
    explain: 'The magnitude is the parallelogram’s area; the triangle is half of it. Dropping or adding that factor of ½ is the usual mistake.',
  },
  {
    topicId: 'm12-vector-algebra-scalar-triple-product-and-coplanarity',
    question: 'Three non-zero vectors are coplanar when their scalar triple product is',
    options: ['1', '0', 'positive', 'negative'],
    answer: 1,
    explain: '[a b c] measures the volume of the parallelepiped they span. Zero volume means they lie in one plane. The sign otherwise only records orientation.',
  },

  // ------------------------------------------------ Maths 12 · Differential Equations
  {
    topicId: 'm12-differential-equations-order-degree-and-formation-of-a-differen',
    question: 'The DEGREE of a differential equation is',
    options: [
      'the order of the highest derivative present',
      'the power of the highest order derivative, once the equation is polynomial in its derivatives',
      'always 1',
      'the number of terms in the equation',
    ],
    answer: 1,
    explain: 'Order counts derivatives; degree is the exponent on the highest one. Degree is undefined when the equation cannot be made polynomial in the derivatives — for instance if a derivative sits inside a sine or a logarithm.',
  },
  {
    topicId: 'm12-differential-equations-variable-separable-equations',
    question: 'A first-order equation is separable when it can be written as',
    options: ['dy/dx = f(x)·g(y)', 'dy/dx + Py = Q', 'dy/dx = F(y/x)', 'as a second-order equation'],
    answer: 0,
    explain: 'The variables then split onto opposite sides and each is integrated separately. The second option is the linear form and the third the homogeneous form, each with its own method.',
  },
  {
    topicId: 'm12-differential-equations-homogeneous-differential-equations',
    question: 'A homogeneous equation of the form dy/dx = F(y/x) is solved by substituting',
    options: ['y = vx', 'v = xy', 'y = v + x', 'x = v + y'],
    answer: 0,
    explain: 'Putting y = vx makes dy/dx = v + x·dv/dx and reduces the equation to a separable one in v and x. If the equation is homogeneous in the other sense, x = vy works instead.',
  },
  {
    topicId: 'm12-differential-equations-linear-equations-and-the-integrating-fac',
    question: 'For dy/dx + Py = Q, where P and Q are functions of x, the integrating factor is',
    options: ['e^{∫P dx}', 'e^{∫Q dx}', '∫P dx', 'e^{−∫P dx}'],
    answer: 0,
    explain: 'Multiplying through by e^{∫P dx} makes the left side an exact derivative. Note P is the coefficient of y, so the equation must first be arranged with the coefficient of dy/dx equal to 1.',
  },

  // -------------------------------------------------------- Maths 12 · Determinants
  {
    topicId: 'm12-determinants-properties-of-determinants',
    question: 'If two rows of a determinant are identical, its value is',
    options: ['1', '0', 'undefined', 'the product of the diagonal entries'],
    answer: 1,
    explain: 'Swapping the two identical rows must flip the sign yet leave the determinant unchanged, so it has to be zero. Interchanging any two rows changes the sign; multiplying one row by k multiplies the determinant by k.',
  },
  {
    topicId: 'm12-determinants-minors-cofactors-and-the-adjoint',
    question: 'The sum of the products of the elements of one row with the cofactors of a DIFFERENT row equals',
    options: ['|A|', '0', '1', '−|A|'],
    answer: 1,
    explain: 'Matching a row with its own cofactors gives |A|; pairing it with another row’s cofactors always gives zero. This is exactly what makes A·adj(A) = |A|·I.',
  },
  {
    topicId: 'm12-determinants-inverse-of-a-matrix-using-the-adjoint',
    question: 'The formula A⁻¹ = adj(A)/|A| can be used only when',
    options: ['A is symmetric', '|A| ≠ 0', 'A is of order 2', 'A is diagonal'],
    answer: 1,
    explain: 'A zero determinant makes the matrix singular and non-invertible. Only square matrices have an inverse at all.',
  },
  {
    topicId: 'm12-determinants-consistency-of-a-system-of-linear-equati',
    question: 'For a system AX = B with |A| = 0 and (adj A)·B ≠ O, the system has',
    options: ['a unique solution', 'infinitely many solutions', 'no solution', 'exactly two solutions'],
    answer: 2,
    explain: 'It is inconsistent. If instead |A| = 0 and (adj A)·B = O the system either has infinitely many solutions or none. A unique solution requires |A| ≠ 0.',
  },
  {
    topicId: 'm12-determinants-area-of-a-triangle-and-the-collinearity-',
    question: 'For three collinear points, the determinant used to compute the area of the triangle they form is',
    options: ['1', '0', 'infinite', 'equal to the perimeter'],
    answer: 1,
    explain: 'Collinear points enclose no area. This gives the standard collinearity test. Since area cannot be negative, the formula carries a modulus.',
  },

  // ------------------------------------------------------------ Maths 12 · Matrices
  {
    topicId: 'm12-matrices-types-of-matrices-and-the-conditions-for',
    question: 'Two matrices can be added only if they',
    options: ['are both square', 'have the same order', 'are both invertible', 'have equal determinants'],
    answer: 1,
    explain: 'Addition works entry by entry, so the dimensions must match exactly. Multiplication has a different requirement — the columns of the first must equal the rows of the second.',
  },
  {
    topicId: 'm12-matrices-matrix-multiplication-and-why-it-is-not-',
    question: 'For matrices A and B where both products are defined, AB = BA holds',
    options: ['always', 'never', 'only in special cases', 'whenever both are square'],
    answer: 2,
    explain: 'Matrix multiplication is associative and distributive but not commutative in general. Being square is not sufficient — order matters, which is why AB = O does not imply that A or B is O.',
  },
  {
    topicId: 'm12-matrices-transpose-symmetric-and-skew-symmetric-m',
    question: 'For any square matrix A, the matrix A + A′ is always',
    options: ['skew-symmetric', 'symmetric', 'singular', 'the identity'],
    answer: 1,
    explain: '(A + A′)′ = A′ + A, so it is symmetric, while A − A′ is skew-symmetric. Every square matrix splits into the sum of these two. A skew-symmetric matrix always has zeros along its diagonal.',
  },
  {
    topicId: 'm12-matrices-invertibility-and-elementary-operations',
    question: 'A square matrix A is invertible if and only if',
    options: ['A is symmetric', '|A| ≠ 0', 'A is of even order', 'A is diagonal'],
    answer: 1,
    explain: 'A non-zero determinant is exactly the condition. The inverse, when it exists, is unique, and (AB)⁻¹ = B⁻¹A⁻¹ — note the reversed order.',
  },

  // --------------------------------------------------------- Maths 12 · Probability
  {
    topicId: 'm12-probability-conditional-probability',
    question: 'The conditional probability P(A | B) is defined as',
    options: ['P(A ∩ B)/P(B), for P(B) ≠ 0', 'P(A ∩ B)/P(A)', 'P(A) + P(B)', 'P(A)·P(B)'],
    answer: 0,
    explain: 'Conditioning on B restricts the sample space to B, so you divide by P(B). Dividing by the wrong one reverses the conditioning and gives P(B | A) instead.',
  },
  {
    topicId: 'm12-probability-independent-events-versus-mutually-exclu',
    question: 'Two events A and B are independent when',
    options: ['P(A ∩ B) = 0', 'P(A ∩ B) = P(A)·P(B)', 'they are mutually exclusive', 'P(A ∪ B) = 1'],
    answer: 1,
    explain: 'Independence and mutual exclusivity are opposites in practice — two events of non-zero probability that are mutually exclusive cannot be independent, because one occurring makes the other impossible.',
  },
  {
    topicId: 'm12-probability-total-probability-and-bayes-theorem',
    question: 'Bayes’ theorem is the tool for finding',
    options: [
      'the probability of a cause, given that an effect has been observed',
      'the mean of a distribution',
      'whether two events are mutually exclusive',
      'the variance of a random variable',
    ],
    answer: 0,
    explain: 'It reverses the conditioning: from P(effect | cause) to P(cause | effect). The denominator is supplied by the theorem of total probability over a partition of the sample space.',
  },
  {
    topicId: 'm12-probability-random-variables-and-probability-distrib',
    question: 'For any probability distribution of a random variable, the sum of all the probabilities must be',
    options: ['0', '1', 'equal to the number of outcomes', 'between 0 and the number of outcomes'],
    answer: 1,
    explain: 'The outcomes are exhaustive, so the probabilities total 1 and each lies in [0, 1]. Checking this is the quickest way to catch an arithmetic slip before computing a mean or variance.',
  },

  // ------------------------------------------- Maths 12 · Applications of Integrals
  {
    topicId: 'm12-applications-of-integrals-area-under-a-curve',
    question: 'For f(x) ≥ 0 on [a, b], the area bounded by y = f(x), the x-axis and the lines x = a, x = b is',
    options: ['∫ₐᵇ f(x) dx', '∫ₐᵇ f(x)² dx', 'f(b) − f(a)', '∫ₐᵇ (1/f(x)) dx'],
    answer: 0,
    explain: 'The definite integral sums infinitesimal strips of height f(x) and width dx. For a region bounded with respect to the y-axis you integrate x as a function of y instead.',
  },
  {
    topicId: 'm12-applications-of-integrals-area-between-two-curves',
    question: 'The area between y = f(x) and y = g(x) from a to b, where f(x) ≥ g(x) throughout, is',
    options: ['∫ₐᵇ (f + g) dx', '∫ₐᵇ (f − g) dx', '∫ₐᵇ f dx − g(b)', '∫ₐᵇ |f| dx'],
    answer: 1,
    explain: 'Upper curve minus lower curve, integrated across the interval. If the curves cross inside [a, b] you must split at the intersection, because the roles of upper and lower swap.',
  },
  {
    topicId: 'm12-applications-of-integrals-handling-regions-below-the-axis',
    question: 'When part of the curve lies below the x-axis, computing the enclosed AREA requires that you',
    options: [
      'ignore that part of the region',
      'split the integral at the crossing point and take the modulus of the negative portion',
      'square the integrand',
      'double the result',
    ],
    answer: 1,
    explain: 'A definite integral counts area below the axis as negative, so the two portions would cancel. Area is a positive quantity, so the pieces must be handled separately and their magnitudes added.',
  },

  // -------------------------------------- Maths 12 · Inverse Trigonometric Functions
  {
    topicId: 'm12-inverse-trigonometric-functions-principal-value-branches',
    question: 'The principal value branch of sin⁻¹x is',
    options: ['[0, π]', '[−π/2, π/2]', '(−π/2, π/2)', '[0, π/2]'],
    answer: 1,
    explain: 'Sine is restricted to [−π/2, π/2] so that it becomes one-one and invertible there. The endpoints are included, since sin⁻¹(±1) = ±π/2.',
  },
  {
    topicId: 'm12-inverse-trigonometric-functions-domains-and-ranges-of-the-inverse-functi',
    question: 'The range of cos⁻¹x is',
    options: ['[−π/2, π/2]', '[0, π]', '(0, π)', '[−π, π]'],
    answer: 1,
    explain: 'Cosine is one-one on [0, π], so that is the principal branch. Note that sin⁻¹ and tan⁻¹ take negative values while cos⁻¹ never does — a frequent source of sign errors.',
  },
  {
    topicId: 'm12-inverse-trigonometric-functions-properties-and-identities',
    question: 'The value of sin⁻¹(sin(3π/4)) is',
    options: ['3π/4', 'π/4', '−π/4', 'π'],
    answer: 1,
    explain: '3π/4 lies outside the principal range, so the identity sin⁻¹(sin θ) = θ does not apply. Since sin(3π/4) = sin(π/4) and π/4 is in range, the answer is π/4. Always check whether the angle sits in the principal branch first.',
  },

  // ------------------------------------------------- Maths 12 · Relations & Functions
  {
    topicId: 'm12-relations-functions-types-of-relations-and-equivalence-relat',
    question: 'On the set of all lines in a plane, the relation "is perpendicular to" is',
    options: [
      'reflexive only',
      'symmetric but neither reflexive nor transitive',
      'transitive but not symmetric',
      'an equivalence relation',
    ],
    answer: 1,
    explain: 'No line is perpendicular to itself, so it fails reflexivity. If a ⊥ b then b ⊥ a, so it is symmetric. But a ⊥ b and b ⊥ c makes a parallel to c, not perpendicular, so transitivity fails.',
  },
  {
    topicId: 'm12-relations-functions-one-one-onto-and-bijective-functions',
    question: 'The function f: R → R defined by f(x) = x² is',
    options: [
      'one-one and onto',
      'neither one-one nor onto',
      'one-one but not onto',
      'onto but not one-one',
    ],
    answer: 1,
    explain: 'f(−2) = f(2) breaks injectivity, and no negative number is ever an output, so it is not surjective either. Restricting the domain and codomain to [0, ∞) would make it bijective — the domain is part of the function.',
  },
  {
    topicId: 'm12-relations-functions-composition-of-functions',
    question: 'If f and g are both one-one, then the composition g∘f is',
    options: ['not necessarily one-one', 'always one-one', 'always onto', 'never one-one'],
    answer: 1,
    explain: 'Injectivity survives composition. Surjectivity does too, so a composition of bijections is a bijection. Note that g∘f and f∘g are generally different functions.',
  },
  {
    topicId: 'm12-relations-functions-invertible-functions',
    question: 'A function is invertible if and only if it is',
    options: ['one-one', 'onto', 'bijective', 'continuous'],
    answer: 2,
    explain: 'It must be both injective and surjective — injective so each output has one source, surjective so every element of the codomain is reached. Continuity is irrelevant to invertibility.',
  },

  // -------------------------------------------------- Maths 12 · Linear Programming
  {
    topicId: 'm12-linear-programming-formulating-an-lpp-objective-function-an',
    question: 'In a linear programming problem, the quantity to be maximised or minimised is called the',
    options: ['constraint', 'objective function', 'feasible region', 'decision variable'],
    answer: 1,
    explain: 'The constraints are the inequalities restricting the variables, and the region they carve out is the feasible region. The objective function is what you optimise over it.',
  },
  {
    topicId: 'm12-linear-programming-feasible-region-and-the-corner-point-the',
    question: 'If an optimal solution to an LPP exists, it occurs',
    options: [
      'at the centre of the feasible region',
      'at a corner point (vertex) of the feasible region',
      'anywhere in the interior',
      'outside the feasible region',
    ],
    answer: 1,
    explain: 'This is the corner point theorem, so only the vertices need testing. If the feasible region is unbounded, an optimum may not exist at all and the corner value must be checked against the open direction.',
  },

  // ------------------------------------------ Maths 12 · Three Dimensional Geometry
  {
    topicId: 'm12-three-dimensional-geometry-direction-cosines-and-direction-ratios',
    question: 'A line makes angles 90°, 60° and 30° with the x, y and z axes. Its direction cosines are',
    options: ['0, 1/2, √3/2', '1, 1/2, √3/2', '0, √3/2, 1/2', '1/2, 0, √3/2'],
    answer: 0,
    explain: 'cos 90° = 0, cos 60° = 1/2, cos 30° = √3/2. Check: 0 + 1/4 + 3/4 = 1.',
  },
  {
    topicId: 'm12-three-dimensional-geometry-equation-of-a-line-in-vector-and-cartesi',
    question: 'The line through (1, 2, 3) parallel to 2î − ĵ + k̂ is',
    options: [
      '(x−1)/2 = (y−2)/(−1) = (z−3)/1',
      '(x−2)/1 = (y+1)/2 = (z−1)/3',
      '(x+1)/2 = (y+2)/(−1) = (z+3)/1',
      '(x−1)/1 = (y−2)/2 = (z−3)/3',
    ],
    answer: 0,
    explain: 'The point supplies the numerators and the direction vector the denominators.',
  },
  {
    topicId: 'm12-three-dimensional-geometry-equation-of-a-plane-and-the-meaning-of-t',
    question: 'A normal vector to the plane 2x − 3y + 6z = 7 is',
    options: ['(7, 0, 0)', '(2, −3, 6)', '(2, 3, 6)', '(−2, 3, 6)'],
    answer: 1,
    explain: 'The coefficients of x, y and z are the normal. Signs carry over exactly — do not drop the minus.',
  },
  {
    topicId: 'm12-three-dimensional-geometry-angle-between-lines-planes-and-a-line-an',
    question: 'For a line of direction b and a plane of normal n, the angle θ between them satisfies',
    options: [
      'cos θ = |b·n| / (|b||n|)',
      'sin θ = |b·n| / (|b||n|)',
      'tan θ = |b·n| / (|b||n|)',
      'cos θ = |b × n| / (|b||n|)',
    ],
    answer: 1,
    explain: 'b·n gives the angle to the NORMAL; the angle to the plane is its complement, so it comes out as sine. Line-to-line and plane-to-plane use cosine.',
  },
  {
    topicId: 'm12-three-dimensional-geometry-shortest-distance-between-skew-lines',
    question: 'The shortest distance between r = a₁ + λb₁ and r = a₂ + μb₂ (skew) is',
    options: [
      '|(a₂ − a₁) · (b₁ × b₂)| / |b₁ × b₂|',
      '|(a₂ − a₁) × (b₁ · b₂)| / |b₁ · b₂|',
      '|(a₂ − a₁) · (b₁ + b₂)| / |b₁ + b₂|',
      '|a₂ − a₁| / |b₁ × b₂|',
    ],
    answer: 0,
    explain: 'b₁ × b₂ is perpendicular to both lines; projecting the joining vector onto that direction gives the gap. If b₁ × b₂ = 0 the lines are parallel and this formula does not apply.',
  },
  {
    topicId: 'm12-three-dimensional-geometry-foot-of-perpendicular-and-image-of-a-poi',
    question: 'The image of the point (1, 2, 3) in the plane x + y + z = 0 is',
    options: ['(−3, −2, −1)', '(−1, −2, −3)', '(3, 2, 1)', '(−2, −1, 0)'],
    answer: 0,
    explain: 'With n = (1,1,1), the signed distance is (1+2+3)/3 = 2. The image is P − 2(2)n = (1,2,3) − (4,4,4) = (−3,−2,−1).',
  },

  // ----------------------------------- Biology 12 · Molecular Basis of Inheritance
  {
    topicId: 'b12-molecular-basis-of-inheritance-dna-structure-and-the-numbers-34-3-4-10-',
    question: 'In B-DNA, the rise between two consecutive base pairs is',
    options: ['34 Å', '3.4 Å', '20 Å', '10 Å'],
    answer: 1,
    explain: '3.4 Å per base pair, 34 Å per full turn, 10 bp per turn, 20 Å diameter. Length calculations use 3.4 Å.',
  },
  {
    topicId: 'b12-molecular-basis-of-inheritance-the-experiments-griffith-avery-hershey-c',
    question: 'In the Hershey–Chase experiment, the DNA of the bacteriophage was labelled using',
    options: ['³⁵S', '³²P', '¹⁵N', '¹⁴C'],
    answer: 1,
    explain: 'DNA has phosphorus but no sulphur; protein has sulphur but no phosphorus. So ³²P tracks DNA and ³⁵S tracks protein.',
  },
  {
    topicId: 'b12-molecular-basis-of-inheritance-replication-enzymes-leading-and-lagging-',
    question: 'Okazaki fragments on the lagging strand are joined together by',
    options: ['DNA polymerase I', 'helicase', 'DNA ligase', 'primase'],
    answer: 2,
    explain: 'Ligase seals the nicks between fragments. Helicase unwinds, primase lays down RNA primers, polymerase extends.',
  },
  {
    topicId: 'b12-molecular-basis-of-inheritance-transcription-in-prokaryotes-vs-eukaryot',
    question: 'In eukaryotes, hnRNA is transcribed by',
    options: ['RNA polymerase I', 'RNA polymerase II', 'RNA polymerase III', 'DNA polymerase'],
    answer: 1,
    explain: 'Pol I makes rRNA, Pol II makes hnRNA (the mRNA precursor), Pol III makes tRNA and small RNAs.',
  },
  {
    topicId: 'b12-molecular-basis-of-inheritance-genetic-code-and-its-properties',
    question: 'Which of the following is a stop codon?',
    options: ['AUG', 'UGG', 'UAA', 'GUG'],
    answer: 2,
    explain: 'UAA, UAG and UGA terminate. AUG initiates and codes methionine; UGG codes tryptophan.',
  },
  {
    topicId: 'b12-molecular-basis-of-inheritance-translation-initiation-elongation-termin',
    question: 'The initiation codon AUG codes for',
    options: ['methionine', 'valine', 'tryptophan', 'leucine'],
    answer: 0,
    explain: 'Methionine — formylated methionine in prokaryotes. AUG is both the start signal and a normal internal codon.',
  },
  {
    topicId: 'b12-molecular-basis-of-inheritance-lac-operon-regulation-with-and-without-l',
    question: 'In the lac operon, when lactose is absent',
    options: [
      'the repressor binds the operator and transcription is switched off',
      'the repressor binds the promoter and RNA polymerase is blocked',
      'transcription proceeds at maximum rate',
      'the inducer binds the operator directly',
    ],
    answer: 0,
    explain: 'The i gene product binds the operator and blocks transcription. Lactose acts as inducer, binding the repressor and releasing the operator — negative regulation, inducible.',
  },
];

export const questionForTopic = (topicId: string): TopicQuestion | undefined =>
  QUESTIONS.find((q) => q.topicId === topicId);

/**
 * A chapter is testable only when every one of its topics has a question.
 * Anything less cannot certify mastery, so the UI must not offer it.
 */
export const hasCompleteTest = (classId: 11 | 12, subject: string, chapter: string): boolean => {
  const topics = topicsForChapter(classId, subject, chapter);
  return topics.length > 0 && topics.every((t) => !!questionForTopic(t.id));
};

export const testForChapter = (
  classId: 11 | 12,
  subject: string,
  chapter: string,
): { topic: Topic; question: TopicQuestion }[] =>
  topicsForChapter(classId, subject, chapter)
    .map((topic) => ({ topic, question: questionForTopic(topic.id)! }))
    .filter((r) => !!r.question);
