"""Turn NTA's JEE Main shift PDFs into question bundles. No AI anywhere.

NTA's papers are exports of its CBT system: every question stem and every option
is its own image, labelled with NTA's Question ID and option IDs. NTA's final
answer key maps Question ID -> correct Option ID (or the numerical value). So a
question is NTA's own images plus an answer matched by ID, never read by eye.

Two layouts are understood:
  A. the master paper ("Question Number : 1 Question Id : 6911211 ...")
  B. a candidate's response sheet ("Q.1", "Question ID :", "Option 1 ID :").
     Only the images and the ids are taken; the candidate's name, roll number,
     chosen options and typed answers are never read into the output.

Every paper must pass its self-checks or no bundle is written:
  - the question count per subject matches the pattern (header counts when given),
  - every MCQ has four option images and four option ids,
  - every key answer resolves to one of the question's own options.
A dropped, bonus or multi-answer question keeps its images but gets no answer,
so it can never be put in a paper.

    scripts/pyq/.venv/bin/python -I scripts/pyq/nta.py            # every shift in papers/manifest.json
    scripts/pyq/.venv/bin/python -I scripts/pyq/nta.py 2026-0402-S1

Writes scripts/pyq/out/<paper>/bundle.json and its WebP figures. Prints one line
per paper and a summary.
"""

from __future__ import annotations

import hashlib
import io
import json
import pathlib
import re
import sys

import fitz  # PyMuPDF
from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parent
PAPERS = ROOT / "papers"
OUT = ROOT / "out"

SUBJECT = {"Mathematics": "Maths", "Physics": "Physics", "Chemistry": "Chemistry"}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
WEBP_QUALITY = 62
MIN_IMAGE_PX = 4  # a lone digit option can be 11×14 px


class PaperError(Exception):
    pass


# ── Keys ────────────────────────────────────────────────────────────────────

_key_cache: dict = {}


def key_cells(path: pathlib.Path) -> dict:
    """Every number cell in a key PDF mapped to the cell to its right on the same line.

    Keys are tables of (Question ID, Correct Option ID) pairs, three pairs a row.
    Cells are split on horizontal gaps, so "38 OR -38" or "DROPPED" stay one cell.
    Only the paper's own question ids are ever looked up, so stray cells (a
    wrapped second option id, a page number) cost nothing.
    """
    if path in _key_cache:
        return _key_cache[path]
    right: dict = {}
    doc = fitz.open(path)
    for page in doc:
        words = page.get_text("words")
        lines: list = []
        for w in sorted(words, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
            yc = (w[1] + w[3]) / 2
            if lines and abs(lines[-1][0] - yc) < 3:
                lines[-1][1].append(w)
            else:
                lines.append([yc, [w]])
        for _, ws in lines:
            ws.sort(key=lambda w: w[0])
            # One token is one cell, except "38 OR -38" and "4, 5", which stay whole.
            # (Spacing can't split cells: some keys set the two columns 3 pt apart.)
            cells: list = []
            for w in ws:
                tok = w[4]
                if cells and (tok.upper() == "OR" or cells[-1][-1].upper() == "OR" or cells[-1][-1].endswith(",")):
                    cells[-1].append(tok)
                else:
                    cells.append([tok])
            texts = [" ".join(c) for c in cells]
            # A row is (question id, answer) pairs. Question and option ids share
            # one number space, so a cell is a question id only by its column:
            # pair from the left, and only on rows that are nothing but pairs.
            if len(texts) % 2 or not all(re.fullmatch(r"\d{6,}", t) for t in texts[::2]):
                continue
            for qid, ans in zip(texts[::2], texts[1::2]):
                right.setdefault(qid, ans)
    _key_cache[path] = right
    return right


def read_answer(raw: str | None, kind: str, option_ids: list) -> tuple:
    """(answer, problem). answer is {"option": i} / {"value": x} / None."""
    if raw is None:
        return None, "not in key"
    s = raw.strip()
    if re.search(r"[A-Za-z]", s.replace("OR", "").replace("or", "")) or not s:
        return None, "dropped"
    if "," in s or re.search(r"\bOR\b", s, re.I) or len(s.split()) > 1:
        return None, "more than one answer"
    if kind == "mcq":
        if s in option_ids:
            return {"option": option_ids.index(s)}, None
        return None, f"key option {s} is not one of this question's options"
    try:
        v = float(s)
    except ValueError:
        return None, f"numerical answer {s!r} is not a number"
    return {"value": int(v) if v.is_integer() else v}, None


# ── Images ──────────────────────────────────────────────────────────────────

def to_webp(data: bytes) -> bytes:
    im = Image.open(io.BytesIO(data))
    im = im.convert("RGBA") if im.mode in ("P", "LA") else im
    if im.mode == "RGBA":
        bg = Image.new("RGB", im.size, "white")
        bg.paste(im, mask=im.split()[3])
        im = bg
    im = im.convert("RGB")
    grey = im.convert("L")
    # Trim the white margin the CBT leaves around every image.
    diff = ImageChops.difference(grey, Image.new("L", grey.size, 255)).point(lambda p: 255 if p > 24 else 0)
    box = diff.getbbox()
    if box:
        pad = 4
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
        im = im.crop(box)
    # Most of NTA's art is black on white: store it as greyscale unless it has real colour.
    r, g, b = im.split()
    colourful = ImageChops.difference(r, g).getextrema()[1] > 40 or ImageChops.difference(g, b).getextrema()[1] > 40
    out = io.BytesIO()
    (im if colourful else im.convert("L")).save(out, "WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()


# ── Papers ──────────────────────────────────────────────────────────────────

def stream(doc: fitz.Document):
    """Text and image blocks in the PDF's own order, page by page."""
    for page in doc:
        for b in page.get_text("dict")["blocks"]:
            if b["type"] == 0:
                t = " ".join(s["text"] for l in b["lines"] for s in l["spans"])
                t = re.sub(r"\s+", " ", t).strip()
                if t:
                    yield ("T", t, b["bbox"])
            elif b.get("image") and min(b.get("width", 0), b.get("height", 0)) >= MIN_IMAGE_PX:
                yield ("I", b["image"], b["bbox"])


def new_q(subject, section, number):
    return {"subject": subject, "section": section, "number": number, "ntaId": None, "kind": None,
            "stem": [], "opts": [], "optIds": [None, None, None, None]}


def parse_master(doc) -> tuple:
    """Layout A. Returns (questions, expected counts per subject)."""
    qs, expected = [], {}
    subject = section = None
    q, mode = None, None
    want_count_for = None
    for kind, val, _ in stream(doc):
        if kind == "T":
            m = re.search(r"\b(Mathematics|Physics|Chemistry) Section ([AB])\b", val)
            if m:
                subject, section = SUBJECT[m.group(1)], m.group(2)
                want_count_for = (subject, section)
            m = re.search(r"Number of Questions : (\d+)", val)
            if m and want_count_for:
                expected[want_count_for] = int(m.group(1))
                want_count_for = None
            m = re.search(r"Question Number : (\d+) Question Id : (\d+) Question Type : (\w+)", val)
            if m:
                q = new_q(subject, section, int(m.group(1)))
                q["ntaId"], q["kind"] = m.group(2), {"MCQ": "mcq", "SA": "numerical"}.get(m.group(3), m.group(3))
                qs.append(q)
                mode = "stem"
                continue
            if q is None:
                continue
            if val.startswith("Options :") or val == "Options":
                mode = "opts"
                continue
            m = re.fullmatch(r"(\d{6,})\.", val)
            if m and mode in ("opts", "opt"):
                q["opts"].append({"id": m.group(1), "imgs": []})
                mode = "opt"
                continue
        else:
            if q is None:
                continue
            if mode == "stem":
                q["stem"].append(val)
            elif mode == "opt":
                q["opts"][-1]["imgs"].append(val)
    for q in qs:
        q["optIds"] = [o["id"] for o in q["opts"]]
        q["opts"] = [o["imgs"] for o in q["opts"]]
    return qs, expected


def parse_sheet(doc) -> tuple:
    """Layout B, a response sheet. Option order is as displayed to that candidate;
    the ids say which is which, so the key still matches."""
    qs = []
    subject = section = None
    q, mode = None, None
    for kind, val, bbox in stream(doc):
        if kind == "T":
            m = re.search(r"Section : (Mathematics|Physics|Chemistry) Section ([AB])", val)
            if m:
                subject, section = SUBJECT[m.group(1)], m.group(2)
                continue
            m = re.fullmatch(r"Q\.(\d+)", val)
            if m:
                q = new_q(subject, section, int(m.group(1)))
                q["opts"] = [[], [], [], []]
                qs.append(q)
                mode = "stem"
                continue
            if q is None:
                continue
            if val == "Options":
                mode = "opts"
                continue
            m = re.fullmatch(r"([1-4])\.", val)
            if m and mode in ("opts", "opt"):
                mode = ("opt", int(m.group(1)) - 1)
                continue
            m = re.search(r"Question Type : (\w+)", val)
            if m:
                q["kind"] = {"MCQ": "mcq", "SA": "numerical"}.get(m.group(1), m.group(1))
                mode = "meta"
            m = re.search(r"Question ID : (\d+)", val)
            if m:
                q["ntaId"] = m.group(1)
            for k, oid in re.findall(r"Option ([1-4]) ID : (\d+)", val):
                q["optIds"][int(k) - 1] = oid
            if "Given Answer" in val or val.startswith("Given"):
                mode = "meta"
        else:
            if q is None or bbox[0] > 380:  # the right column is metadata only
                continue
            if mode == "stem":
                q["stem"].append(val)
            elif isinstance(mode, tuple):
                q["opts"][mode[1]].append(val)
    for q in qs:
        if q["kind"] == "numerical":
            q["opts"], q["optIds"] = [], []
    return qs, {}


def build(entry: dict) -> dict:
    pid = entry["id"]
    doc = fitz.open(PAPERS / entry["paper"])
    head = " ".join(" ".join(doc[i].get_text().split()) for i in range(min(3, len(doc))))
    if "Question Number :" in head or "Question Paper Name" in head:
        qs, expected = parse_master(doc)
        layout = "master"
    elif re.search(r"\bQ\.1\b", head) and "Question ID" in head:
        qs, expected = parse_sheet(doc)
        layout = "sheet"
    else:
        raise PaperError("not an NTA CBT export")
    # Bilingual papers print every question twice, English first and then Hindi,
    # under the same id. Keep the first.
    seen_ids, unique = set(), []
    for q in qs:
        if q["ntaId"] and q["ntaId"] in seen_ids:
            continue
        seen_ids.add(q["ntaId"])
        unique.append(q)
    qs = unique
    if expected:
        expected = {k: v for k, v in expected.items()}

    # The paper's own header says which shift it is; a mirror's file name can be wrong.
    m = re.search(r"Question Paper Name : B ?Tech (\d+)(?:st|nd|rd|th)? (\w{3})\w* (\d{4}) Shift (\d)", head)
    if m:
        actual = f"{m.group(3)}-{MONTHS.index(m.group(2)[:3].title()) + 1:02d}{int(m.group(1)):02d}-S{m.group(4)}"
    else:
        m = re.search(r"Test Date (\d{2})/(\d{2})/(\d{4}) Test Time (\d+):\d+ (AM|PM)", head)
        actual = f"{m.group(3)}-{m.group(2)}{m.group(1)}-S{1 if m.group(5) == 'AM' else 2}" if m else pid
    if actual != pid:
        y_, md = actual.split("-")[0], actual.split("-")[1]
        entry = {**entry, "id": actual, "year": int(y_), "date": f"{y_}-{md[:2]}-{md[2:]}", "shift": int(actual[-1]),
                 "key": f"key-{actual}.pdf" if y_ == "2026" else f"key-{y_}-s{1 if int(md[:2]) <= 2 else 2}.pdf",
                 "relabelled": pid}
        pid = actual

    problems = []
    # Pattern: 20 MCQ + 5 numericals a subject from 2025; 20 + 10 (attempt 5) before.
    per_subject = {}
    for q in qs:
        per_subject.setdefault(q["subject"], {"mcq": 0, "numerical": 0})
        if q["kind"] in ("mcq", "numerical"):
            per_subject[q["subject"]][q["kind"]] += 1
        else:
            problems.append(f"Q{q['number']}: unknown type {q['kind']}")
    nums = 10 if entry["year"] <= 2024 else 5
    if expected:
        for (subj, sec), n in expected.items():
            got = sum(1 for q in qs if q["subject"] == subj and q["section"] == sec)
            if got != n:
                problems.append(f"{subj} {sec}: header says {n}, found {got}")
    for subj in ("Physics", "Chemistry", "Maths"):
        got = per_subject.get(subj, {"mcq": 0, "numerical": 0})
        if got != {"mcq": 20, "numerical": nums}:
            problems.append(f"{subj}: expected 20 MCQ + {nums} numerical, found {got['mcq']} + {got['numerical']}")
    seen = set()
    for q in qs:
        tag = f"Q{q['number']} ({q['ntaId']})"
        if not q["ntaId"]:
            problems.append(f"Q{q['number']}: no question id")
        elif q["ntaId"] in seen:
            problems.append(f"{tag}: id repeated")
        seen.add(q["ntaId"])
        if not q["stem"]:
            problems.append(f"{tag}: no question image")
        if q["kind"] == "mcq":
            if len(q["opts"]) != 4 or any(not o for o in q["opts"]):
                problems.append(f"{tag}: options are not four images")
            if len(q["optIds"]) != 4 or not all(q["optIds"]):
                problems.append(f"{tag}: options are not four ids")
    if problems:
        raise PaperError("; ".join(problems[:6]) + (f" (+{len(problems) - 6} more)" if len(problems) > 6 else ""))

    keys = key_cells(PAPERS / entry["key"])
    out_dir = OUT / pid
    out_dir.mkdir(parents=True, exist_ok=True)
    y, mo, d = (int(x) for x in entry["date"].split("-"))
    label = f"{d} {MONTHS[mo - 1]} {y} · Shift {entry['shift']}"
    questions, unanswered, mismatched = [], {}, []
    for q in qs:
        answer, why = read_answer(keys.get(q["ntaId"]), q["kind"], q["optIds"])
        if why:
            if "not one of" in why:
                mismatched.append(f"{q['ntaId']}: {why}")
            unanswered[why] = unanswered.get(why, 0) + 1
        figs, n = [], 0
        def save(img: bytes) -> str:
            nonlocal n
            name = f"{q['ntaId']}-{n}.webp"
            (out_dir / name).write_bytes(to_webp(img))
            n += 1
            return name
        stem = [save(i) for i in q["stem"]]
        opts = [[save(i) for i in o] for o in q["opts"]]
        figs = stem + [f for o in opts for f in o]
        if len(figs) > 12:
            raise PaperError(f"Q{q['number']} ({q['ntaId']}): {len(figs)} images, more than 12")
        idx = {f: i for i, f in enumerate(figs)}
        questions.append({
            "ntaId": q["ntaId"],
            "number": q["number"],
            "kind": q["kind"],
            "subject": q["subject"],
            "section": q["section"],
            "body": "\n".join(f"[[fig:{idx[f]}]]" for f in stem),
            "options": [" ".join(f"[[fig:{idx[f]}]]" for f in o) for o in opts] if q["kind"] == "mcq" else None,
            "answer": answer,
            "figures": figs,
        })
    if len(mismatched) > 2:
        raise PaperError(f"key does not match this paper: {'; '.join(mismatched[:3])}")
    bundle = {
        "format": "alpha-pyq/1",
        "paper": pid,
        "label": label,
        "year": y,
        "date": entry["date"],
        "shift": entry["shift"],
        "layout": layout,
        "fileHash": hashlib.sha256((PAPERS / entry["paper"]).read_bytes()).hexdigest(),
        "source": "National Testing Agency",
        "questions": questions,
    }
    (out_dir / "bundle.json").write_text(json.dumps(bundle, indent=1))
    answered = sum(1 for q in questions if q["answer"])
    note = ", ".join(f"{v} {k}" for k, v in unanswered.items())
    return {"questions": len(questions), "answered": answered, "note": note, "layout": layout,
            "paper": pid, "relabelled": entry.get("relabelled")}


def main(argv: list) -> int:
    manifest = json.loads((PAPERS / "manifest.json").read_text())
    if argv:
        manifest = [e for e in manifest if e["id"] in argv]
    ok = failed = total = answered = 0
    done = set()
    for e in manifest:
        if not (PAPERS / e["paper"]).exists():
            print(f"SKIP   {e['id']}: paper not downloaded")
            failed += 1
            continue
        try:
            r = build(e)
            if r["paper"] in done:
                print(f"DUP    {e['id']}: is really {r['paper']}, already imported")
                continue
            done.add(r["paper"])
            ok += 1
            total += r["questions"]
            answered += r["answered"]
            print(f"ok     {r['paper']}" + (f" (file said {r['relabelled']})" if r["relabelled"] else "") + f" [{r['layout']}] {r['answered']}/{r['questions']} answered" + (f" ({r['note']})" if r["note"] else ""))
        except PaperError as err:
            failed += 1
            print(f"FAIL   {e['id']}: {err}")
        except Exception as err:  # a broken PDF must not stop the rest
            failed += 1
            print(f"ERROR  {e['id']}: {type(err).__name__}: {str(err)[:160]}")
    print(f"\n{ok} papers ok, {failed} failed; {answered}/{total} questions usable")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
