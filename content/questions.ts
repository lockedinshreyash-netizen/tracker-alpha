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
