"""Tag each PYQ with its chapter.

The tags live in tags.json (committed): ntaId -> "12|Integrals", or null when no
chapter could be settled. They were made in two blind passes by a small model
reading only the on-device OCR text of each question (never the images, never
the answers), with the chapters listed in a different order and the
instructions worded differently each time. A tag is kept where both passes
agree. Every disagreement was settled by hand from the text, or left untagged.
Measured against gold/ (a random sample labelled by hand, and the hand-read
PW chapters matched to NTA's questions), see --eval.

    scripts/pyq/.venv/bin/python -I scripts/pyq/classify.py            # write tags.json into every bundle
    scripts/pyq/.venv/bin/python -I scripts/pyq/classify.py --eval     # accuracy of tags.json on gold/
    scripts/pyq/.venv/bin/python -I scripts/pyq/classify.py --batches  # OCR + batch files for tagging a new year

OCR text is cached per paper in out/<paper>/ocr.json (question) and
ocr_opts.json (options, from ocr_options.py). A question with no entry in
tags.json is left untagged: it still goes into full, subject and real-shift
papers, just not chapter papers. Prints a summary only.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "out"
TAGS = ROOT / "tags.json"
GOLD = ROOT / "gold"
CHAPTERS = json.loads((ROOT.parent / "qbank" / "chapters.json").read_text())


def known(subject: str) -> set:
    return {f"{c}|{n}" for c in ("11", "12") for n in CHAPTERS[subject][c]}


def ocr(path: pathlib.Path) -> str:
    from ocrmac import ocrmac
    return " ".join(r[0] for r in ocrmac.OCR(str(path), recognition_level="accurate").recognize())


def bundles():
    for folder in sorted(p for p in OUT.iterdir() if (p / "bundle.json").exists()):
        yield folder, json.loads((folder / "bundle.json").read_text())


def apply() -> int:
    tags = json.loads(TAGS.read_text()) if TAGS.exists() else {}
    n = tagged = unknown = 0
    per: dict = {}
    for folder, b in bundles():
        for q in b["questions"]:
            key = tags.get(q["ntaId"])
            if key and key not in known(q["subject"]):
                unknown += 1
                key = None
            if key:
                cls, chapter = key.split("|", 1)
                q["classId"], q["chapter"], q["confidence"] = int(cls), chapter, 1.0
            else:
                q["classId"], q["chapter"], q["confidence"] = None, None, None
            n += 1
            st = per.setdefault(q["subject"], [0, 0])
            st[1] += 1
            if key:
                tagged += 1
                st[0] += 1
        (folder / "bundle.json").write_text(json.dumps(b, indent=1))
    print(f"{tagged}/{n} questions tagged with a chapter ({tagged / max(1, n):.0%})")
    for s, (t, total) in per.items():
        print(f"  {s}: {t}/{total}")
    if unknown:
        print(f"  {unknown} tags named a chapter not in chapters.json and were dropped")
    return 0


def evaluate() -> int:
    tags = json.loads(TAGS.read_text())
    for f in sorted(GOLD.glob("*.json")):
        gold = json.loads(f.read_text())
        firm = {k: v for k, v in gold.items() if not v.get("ambiguous")}
        hit = [k for k in firm if tags.get(k)]
        right = sum(tags[k] == firm[k]["key"] for k in hit)
        print(f"{f.stem}: tagged {len(hit)}/{len(firm)}, right {right}/{len(hit)} ({right / max(1, len(hit)):.1%})")
    return 0


def batches() -> int:
    """OCR anything new, then write batch files (one subject, <=100 questions) for a tagging pass."""
    dest = OUT / "_tagging"
    dest.mkdir(exist_ok=True)
    tags = json.loads(TAGS.read_text()) if TAGS.exists() else {}
    rows: dict = {s: [] for s in CHAPTERS}
    for folder, b in bundles():
        cache_file = folder / "ocr.json"
        cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
        opts = json.loads((folder / "ocr_opts.json").read_text()) if (folder / "ocr_opts.json").exists() else {}
        for q in b["questions"]:
            nid = q["ntaId"]
            if nid not in cache:
                stem = q["figures"][: len(re.findall(r"\[\[fig:", q["body"]))]
                cache[nid] = " ".join(ocr(folder / f) for f in stem)
            if nid in tags or q.get("answer") is None:
                continue
            o = " ".join(opts.get(nid, "").split())[:220]
            rows[q["subject"]].append(f"{nid}\t{' '.join(cache[nid].split())[:450]}" + (f"\tOPTIONS: {o}" if o else ""))
        cache_file.write_text(json.dumps(cache))
    n = 0
    for s, rs in rows.items():
        keys = sorted(known(s))
        (dest / f"{s}.chapters.json").write_text(json.dumps(keys))
        head = "\n".join(f"{i + 1}. {k.split('|')[1]} (Class {k.split('|')[0]})" for i, k in enumerate(keys))
        for i in range(0, len(rs), 100):
            n += 1
            (dest / f"{s}-{i // 100:02d}.txt").write_text(
                f"SUBJECT: {s}\nCHAPTERS:\n{head}\n\nQUESTIONS (id<TAB>OCR text<TAB>options):\n" + "\n".join(rs[i:i + 100]) + "\n")
    print(f"{n} batch files in {dest} for {sum(len(r) for r in rows.values())} untagged questions. See README: Tagging a new year.")
    return 0


if __name__ == "__main__":
    sys.exit(evaluate() if "--eval" in sys.argv else batches() if "--batches" in sys.argv else apply())
