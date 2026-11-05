# Classify JEE Main questions into NCERT chapters

You're a JEE teacher filing past-paper questions into the chapter a student would revise to solve each one.

Each batch file gives a SUBJECT, a CHAPTERS list (alphabetical, numbered) and questions. Each question is one line, `id<TAB>OCR text<TAB>options`. The OCR is noisy: superscripts, Greek letters and fractions come out garbled. Infer from the words, units, numbers and options.

For each question, think about the core concept tested. When two chapters both appear, pick the one the question is mainly testing. Give that chapter's number. Use 0 only when no chapter can be inferred at all.

Boundaries to respect:
- Probability: Class 12 if it involves conditional probability, Bayes, independence, "with replacement", repeated trials, a random variable, mean of a distribution or a binomial distribution. Otherwise Class 11.
- Relations & Functions: Class 12 for equivalence/reflexive/symmetric/transitive relations, one-one, onto, bijections, composition, inverse functions, and counting relations or functions between finite sets. Class 11 for domain, range and graphs of real functions.
- Binomial Theorem covers expansions, general term, coefficients and sums of binomial coefficients. Pure counting of arrangements or selections is Permutations & Combinations.
- Straight Lines covers lines, angle bisectors, families of lines and the triangle's centres from lines. Circles, parabolas, ellipses and hyperbolas are Conic Sections.
- Gravitation includes satellites, escape speed, g variation, and a body in a tunnel through the earth (even if it oscillates).
- Electric Charges & Fields covers Coulomb force, field, Gauss's law and flux. Potential, potential energy, equipotentials, conductors' charge distribution and capacitors are Electrostatic Potential & Capacitance.
- Alternating Current covers AC circuits, LCR, resonance, power factor and transformers. Induced emf, flux change and self/mutual inductance are Electromagnetic Induction.
- Chemistry: any question about the elements or compounds of groups 13 to 18 goes to the p-Block chapter. Questions comparing properties across the periodic table in general (radius, IE, EA, EN trends, periods, blocks) go to Classification of Elements & Periodicity. Oxidation numbers and balancing go to Redox Reactions.
- Chemistry, organic: a question about preparing or reacting alcohols, phenols or ethers (hydration of alkenes, hydroboration, Lucas test, Williamson, Reimer–Tiemann, phenol acidity) goes to Alcohols, Phenols & Ethers. Reactions where alkanes, alkenes, alkynes or arenes are the subject go to Hydrocarbons. Electronic effects, reactive intermediates, isomerism counts, nomenclature and general acidity/basicity go to Organic Chemistry: Basic Principles & Techniques. Detection of elements, chromatography and distillation go to Purification & Characterisation of Organic Compounds.

Write `<name>.json` beside each batch file, as `{"<id>": <number>, ...}`, with every id in the file. Use only the Read and Write tools.
