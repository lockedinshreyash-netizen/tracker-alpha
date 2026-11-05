# Shared PYQ bank: NTA's JEE Main papers

Turns NTA's own JEE Main shift PDFs into the shared question bank (`supabase/pyq.sql`).
Every question and option is NTA's image. The answer is NTA's final key, matched by
NTA's Question ID. No AI anywhere, and nothing here costs Claude credits.

## Setup (once)

```bash
python3 -m venv scripts/pyq/.venv
scripts/pyq/.venv/bin/pip install pymupdf pillow ocrmac
```

`.venv/`, `papers/`, `out/` and `.env` are gitignored.

## Run order

Always run with `python -I`. Each step prints a summary, not a dump.

1. **`fetch.py`** downloads every shift in `SHIFTS` plus the answer keys into `papers/` and writes `papers/manifest.json`. Files already there are skipped.
2. **`nta.py`** turns each shift into `out/<paper>/bundle.json` plus WebP figures. A paper that fails its self-checks gets no bundle: section counts, four options per MCQ, and every key ID resolving to an option.
3. **`ocr_options.py`** then **`classify.py`**. These OCR the question and option images on the Mac (Apple Vision), then write the committed `tags.json` (NTA id → `12|Integrals`) into every bundle. `--eval` scores `tags.json` against `gold/`.
4. **`load.py`** upserts rows into `pyq_questions` (on `nta_id`) and figures into the private `pyq` bucket. It's safe to re-run.

```bash
scripts/pyq/.venv/bin/python -I scripts/pyq/fetch.py
scripts/pyq/.venv/bin/python -I scripts/pyq/nta.py
scripts/pyq/.venv/bin/python -I scripts/pyq/ocr_options.py
scripts/pyq/.venv/bin/python -I scripts/pyq/classify.py
scripts/pyq/.venv/bin/python -I scripts/pyq/load.py            # or: load.py 2026-0402-S1
```

`load.py` needs the service-role key in `scripts/pyq/.env`:

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Delete that line once the load is done. The key bypasses every policy.

## How the chapter tags were made

Keyword matching was only about 65% right on a random sample, so `tags.json` was rebuilt on 5 Nov 2026:

1. Two blind passes by Claude Haiku. Each read only the OCR text of the question and its options: no images, no answers. The second pass got reworded instructions and the chapters in a different order.
2. A tag is kept where both passes agree (2,144 questions).
3. The 204 disagreements were settled by hand from the text. Salt analysis, ores, garbled text and mixed questions were left untagged.

Result: 2,321 of 2,348 answerable questions are tagged (98.9%).

- `gold/random-sample.json`: 126 random questions labelled by hand from their text. Tags right on 123 (97.6%).
- `gold/hand-read-pw.json`: NTA questions matched to the hand-read PW chapters. Tags right on 94 of 101 (93.1%). Most misses are where PW's book draws a chapter line differently, e.g. IUPAC naming filed under Alcohols.

The conventions both passes followed are in `tag_guide.md`. Use the same file when tagging a new year, so the chapter lines stay the same.

## Tagging a new year

1. Run `classify.py --batches`. It OCRs anything new and writes batch files of untagged questions to `out/_tagging/`.
2. Ask Claude Code to tag each batch twice with Haiku, following `tag_guide.md`, the second time with the chapters reordered. It should keep agreements and settle disagreements by hand, then merge the result into `tags.json`.
3. Run `classify.py`, then `classify.py --eval`, then `load.py`.

## Adding a year

1. Add the new shifts to `SHIFTS` in `fetch.py` (year, month, day, shift), and the key URLs if NTA moved them (`SESSION_KEYS` / `key_urls`).
2. Run `fetch.py` and `nta.py`, then tag (above), then `load.py`. Only new papers get bundles and uploads.
3. If the paper pattern changes (counts per section), adjust the checks in `nta.py` and `realShifts` in `cbt/generate.ts`. Real shifts are only offered for 20 MCQ + 5 numerical per subject.

## Left out on purpose

- January 2026 mirror files are scans with no Question IDs, so answers can't be matched.
- Some January 2025 files are missing or broken on the mirror.
- 2024 papers had 10 numericals with 5 to attempt. Their questions feed mixed papers only, never a "real shift".
