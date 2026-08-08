# Content sourcing methodology

How the weightage data in `weightageJEE.ts` was produced, what it is safe to
claim from it, and the checks that have to pass before it ships.

Compiled **2026-08-08**. Covers JEE Main (`weightageJEE.ts`) and NEET
(`weightageNEET.ts`).

## The rule that matters

**Count independent datasets, not websites.** Agreement between sites is not
corroboration when the sites are republishing the same table.

Seven sources were pulled for JEE Main chapter weightage. They collapse into
**two** datasets:

### Cluster A — one dataset, four sites
`pw.live`, `vedantu.com`, `selfstudys.com`, `vvtcoaching.com`

Every one reports Current Electricity at **6.57%**, Three Dimensional Geometry
at **7.35%**, Aldehydes/Ketones/Carboxylic Acids at **5.95%** — identical to two
decimal places across all four. That is one dataset syndicated four times, not
four sources agreeing. None of the four states which sessions were analysed, how
many papers, or whether the percentages are of questions or of marks. Only the
attribution "past 5 years".

Naive vote-counting would have scored this 4–3 and treated it as settled.

### Cluster B — independent, coarser
`supertutor.in` (states Jan 2020 – Apr 2025, 10+ sessions), `cracku.in` (states
2022–2024 averages), `testbook.com` (states no basis).

Reports at unit level (Calculus, Coordinate Geometry, Mechanics) rather than
per chapter.

### Where the two clusters agree and disagree

Cross-checked by rolling Cluster A up to Cluster B's unit level:

| Unit | Cluster A (summed) | Cluster B | |
|---|---|---|---|
| Maths — Calculus | 25.4% | 24–28% | agrees |
| Maths — Vectors + 3D | 12.0% | 8–12% | agrees at top of range |
| Maths — Algebra | 29.9% | 20–24% | **disagrees** |
| Maths — Coordinate Geometry | 12.2% | 16–20% | **disagrees** |
| Physics — Modern Physics | 14.4% | 12–16% | agrees |
| Physics — Magnetism + EMI | 11.8% | 12–16% | agrees |
| Physics — Thermo + KTG | 5.9% | 8–12% | **disagrees** |

**Conclusion: rank order is reliable, absolute percentages are not.** Both
clusters put the same chapters at the top and the same at the bottom. They
disagree on magnitude by up to 8 points. The UI should therefore show **tiers**,
and must not present a percentage as a measured fact.

## What the validation checks caught

`scripts/checkContent.mjs` runs three checks. Two of them found real problems
that reading the sources alone would not have.

### 1. Cluster A's Chemistry data is stale — the numbers are ~1.5x too low

Cluster A's Chemistry table sums to 100% across 34 chapters. Our `SYLLABUS_DATA`
has 19. The 15 missing ones are **not gaps in our syllabus** — they are chapters
NTA removed in the rationalised syllabus: States of Matter, Surface Chemistry,
Environmental Chemistry, Polymers, Chemistry in Everyday Life, Hydrogen,
s-Block, p-Block 13 & 14, Solid State, Metallurgy, Salt Analysis.

So Cluster A is averaging over an era when those chapters were still examined.
**About 32% of its Chemistry weightage sits in chapters that are no longer on
the paper**, which means every surviving chapter's true share of the current
paper is roughly **1.47x** the number Cluster A gives it. Coordination Compounds
is listed at 5.33%; against the current syllabus it is closer to 7.9%.

The figures in `weightageJEE.ts` are **as-published, un-renormalised**. They are
not corrected yet, because correcting them requires first confirming the current
chapter list against the official NTA syllabus PDF — see Open questions.

This is the finding that justifies the whole pipeline. It is invisible if you
read the sources and trust the consensus; it only appears when you check whether
the percentages still sum to 100 against *today's* syllabus.

### 2. Percentages must never be summed across Class 11 and 12

Maths rows total 102.68%. Cluster A reports single combined figures for
chapters that appear in both years — Relations & Functions, Probability, and
Limits/Continuity — and our data attributes each to both classes. Any UI that
adds `percent` across classes will overcount by roughly 10 points. Aggregate on
tiers, or dedupe on the shared rows first.

### 3. Weightage alone is dangerous advice — hence `foundational`

13 chapters are load-bearing prerequisites while sitting in the low or medium
tier. The starkest: **Organic Chemistry: Basic Principles & Techniques at 1.57%**,
on which every organic question in the paper depends. Also Laws of Motion
(2.05%), Redox Reactions (1.75%), Periodicity (1.93%), Relations & Functions
(1.25%).

A grid that sorts on weightage and dims the bottom would tell a student to skip
exactly the chapters that make the rest possible. `foundational: true` marks
these, and **must** suppress any deprioritise/skip affordance regardless of tier.

## NEET

Three sources pulled, and unlike JEE they are **three genuinely distinct
datasets** — no syndication. The best of them is better than anything available
on the JEE side.

### neet-a — primary (`rosemaryinstitute.com`)

The only dataset found for either exam that states both its basis and its
sample size: NEET 2020–2024, 257 Botany / 264 Zoology / 263 Chemistry / 252
Physics questions counted. It splits Biology into Botany and Zoology the way the
paper does, its chapter list contains no removed chapters, and its rows sum to
94–102% per section. Used as the primary figure throughout.

### neet-b — corroborating (`store.pw.live`)

Unit-level, no stated basis. Agrees closely with neet-a on Physics — Current
Electricity 10%, Rotational Motion 6%, Ray Optics 6%, Units 5%, Semiconductors
5% — which is what promotes most NEET Physics rows to `confidence: 'high'`.
Never used as a primary figure.

### neet-c — excluded (`careerpower.in`)

Rejected on quality, not by vote. It reports the **obsolete 200-question paper
pattern** ("Physics 50 questions", "Chemistry 35 Section A + 15 Section B") that
NEET dropped in 2025, and its Biology table still lists Transport in Plants,
Mineral Nutrition, Digestion and Absorption, Reproduction in Organisms,
Strategies for Enhancement in Food Production and Environmental Issues — all
removed from the syllabus. Stale on both the paper structure and the syllabus.

Worth being explicit about why this matters: on a naive majority vote this
source counts the same as the PYQ-counted one. Had it been syndicated across
four sites the way the JEE table was, it would have won. **Source quality has to
gate the vote, not the other way round.**

### NEET data quality vs JEE

| | JEE | NEET |
|---|---|---|
| Independent datasets | 2 (from 7 sites) | 3 (from 3 sites) |
| Best source states its N | no | yes (252–264 per subject) |
| Section totals | Chem 67.9%, Phy 94.6%, Maths 102.7% | 94–102% across all four |

The NEET set is substantially more trustworthy. JEE Chemistry remains the
weakest content in the repo.

### NEET-specific findings

**1. Percentages are comparable across subjects — only for NEET.** The paper is
four sections of 45 questions each (Botany, Zoology, Physics, Chemistry), so a
10% Botany chapter is worth the same marks as a 10% Physics chapter.
Cross-subject prioritisation is valid here and is **not** valid for JEE. Note
the tier thresholds differ per exam: NEET critical is ≥7%, JEE critical is ≥4%,
because each NEET section has half as many chapters competing for it.

**2. Botany/Zoology does not follow Class 11/12.** Molecular Basis of
Inheritance is a Class 12 chapter examined in Botany; Biomolecules is Class 11
examined in Zoology. The `stream` field carries this. A NEET student revises by
stream, not by class, so the UI should be able to group either way.

**3. `SYLLABUS_DATA` is missing p-Block for NEET students.** neet-a puts The
p-Block Elements at **12% of Chemistry** — the largest single Chemistry block in
the exam — and our chapter list has no p-Block entry at all, because it tracks
the JEE list where p-Block 13–14 was removed. **The two syllabi diverge and the
app currently only models one.** Recorded in `NEET_SYLLABUS_GAPS`; not added
until confirmed against the official NMC syllabus.

**4. One large unresolved conflict: Physics Thermodynamics.** neet-a counts it
at 2% over 2020–2024; the excluded source rates it 9%. That is the biggest
disagreement found across either exam. Flagged `confidence: 'low'` and no
percentage should be shown for it until a third dataset settles it.

**5. Dual Nature of Radiation & Matter is absent from neet-a's table entirely.**
Its figure comes from the unit-level corroborating source alone — the weakest
row in the NEET Physics set.

## What this method is good for, and what it is not

| Content type | Verdict |
|---|---|
| Chapter weightage / ranking | **Good.** Public, countable, converges. Use it. |
| Topic lists within a chapter | **Good** — but source from the NTA syllabus and NCERT contents, which are authoritative. Not a consensus problem. |
| Difficulty ratings | **Adequate.** Opinion, but consistent opinion. |
| Question archetypes and traps | **Weak.** Blogs rank chapters; they do not enumerate the six ways Rolling Motion gets asked. Needs PYQ work, and should carry `confidence: 'low'` until it has it. |

## Syllabus divergence between the two exams

Settled from articles, cross-checked across three, **not** read off the official
NTA/NMC PDFs — a deliberate call to keep moving. Treat as good, not final.

| Chapter | JEE | NEET |
|---|---|---|
| p-Block Elements | present (15–18 only) | present (13–14 and 15–18) |
| s-Block Elements | deleted | **present** |
| Hydrogen | deleted | **present** |
| States of Matter, Solid State, Surface Chemistry, Polymers, Environmental Chemistry, Chemistry in Everyday Life | deleted | reported present |

`SYLLABUS_DATA` tracks the JEE list, so before this the app showed NEET students
a chapter set missing p-Block — the largest single Chemistry block in their
exam. `EXAM_EXTRA_CHAPTERS` in `constants.tsx` layers the per-exam additions on
top. It is additive only: nothing is removed from the base list, because
`ChapterProgress` is keyed by chapter name and dropping a name would orphan a
student's existing progress.

One article claims Alcohols, Phenols & Ethers was deleted from JEE. Both the
weightage data (3.54%) and the other syllabus sources contradict it, so it was
not acted on.

## Open questions

1. **The chapter lists are article-sourced, not official.** The deletion lists
   contradict each other and are self-evidently wrong in places — one names
   Atomic Structure and Some Basic Concepts of Chemistry as deleted, which the
   PYQ counts disprove outright. Confirming against `jeemain.nta.nic.in` and
   `nmc.org.in` would let JEE Chemistry finally be renormalised (its rows still
   total only 73.5%, so every figure is roughly 1.4x too low).
2. **Find a genuinely independent third dataset**, ideally one counting actual
   NTA question papers per session rather than restating a table.
3. **Confirm the NEET chapter list against the official NMC syllabus PDF.** The
   deletion lists on these sites contradict each other and are self-evidently
   wrong in places — one names Some Basic Concepts of Chemistry, Atomic
   Structure and Chemical Thermodynamics as deleted, which the PYQ counts
   disprove outright. Needed to settle the p-Block gap.
4. `Linear Inequalities`, `Linear Programming` and `Introduction to 3D Geometry`
   appear in no source table. Their figures are assumptions, flagged
   `confidence: 'low'`, and should not be rendered as measured values.

## Before changing any number here

Run `node scripts/checkContent.mjs`. It verifies every `SYLLABUS_DATA` chapter
has a row, reports per-subject totals, and lists the foundational-but-low-tier
chapters that need protecting in the UI.
