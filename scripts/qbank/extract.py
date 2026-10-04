#!/usr/bin/env python3
"""Turn a PYQ PDF into an `alpha-qbank/1` bundle for the CBT's Question bank.

    python extract.py "Physics PYQs.pdf" --subject Physics
    python extract.py paper.pdf --pages 1-20          # a sample, for checking quality

Runs on the laptop, never in the app: the API key stays here, and the app only
ever receives the finished JSON (Mocks -> Question bank -> Import bundle).

How it reads a PDF
------------------
Every page is rendered to an image and sent to DeepSeek's vision model
(`deepseek-flash`), which returns the page as structured JSON: each question's
text with LaTeX, its four options or "numerical", any answer printed beside it,
boxes around its figures, and the syllabus chapter it belongs to — picked from
chapters.json, the app's own list, never invented.

  * Answer keys. Pages that are answer keys (or solutions) are read as
    number -> answer tables and joined to the questions that came before them,
    so a chapter-wise book with a key after every chapter works: each key
    closes the block of questions above it.
  * Page breaks. A question cut off at the bottom of a page is flagged, and
    the continuation at the top of the next page is joined onto it.
  * Figures are cropped here from the rendered page and inlined as WEBP data
    URIs; the app uploads them to its private bucket.
  * Bilingual NTA papers: English only.

Nothing is decided here about whether a question is good enough. The app's
importer does that: no answer -> "no answer", unknown chapter or low
confidence -> "to check", otherwise "ready".

Every page's response is cached under .qbank-cache/<pdf hash>/, so a re-run
(say, after a crash on page 300) never pays for a page twice.
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures as futures
import hashlib
import io
import json
import os
import re
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

try:
    import pypdfium2 as pdfium
    from PIL import Image
    from openai import OpenAI
except ImportError as e:  # pragma: no cover
    sys.exit(f"Missing dependency ({e.name}). Run: pip install -r {Path(__file__).with_name('requirements.txt')}")

HERE = Path(__file__).resolve().parent
CHAPTERS: dict[str, dict[str, list[str]]] = json.loads((HERE / "chapters.json").read_text())
FORMAT = "alpha-qbank/1"
MODEL = os.environ.get("QBANK_MODEL", "deepseek-flash")
BASE_URL = os.environ.get("QBANK_BASE_URL", "https://api.deepseek.com")
PROMPT_VERSION = "v1"  # part of the cache key: changing the prompt re-reads every page

# Rendering: ~150 dpi is enough for the model to read subscripts; figures are
# cropped from the same render and downsized.
RENDER_SCALE = 150 / 72
FIGURE_MAX_WIDTH = 900

# DeepSeek list prices per 1M tokens, peak (off-peak and weekends are half).
# Only used to print an estimate; check https://api-docs.deepseek.com/quick_start/pricing.
PRICE_IN, PRICE_OUT = 0.30, 1.20


def chapter_list(subject: str | None) -> str:
    subjects = [subject] if subject else list(CHAPTERS)
    lines = []
    for s in subjects:
        for cls in ("11", "12"):
            lines.append(f"{s} class {cls}: " + "; ".join(CHAPTERS[s][cls]))
    return "\n".join(lines)


def build_prompt(subject: str | None) -> str:
    return f"""You are reading one page of a JEE question PDF (past papers or practice questions).
Return ONLY a JSON object, no prose, in exactly this shape:

{{
  "page_kind": "questions" | "answer_key" | "solutions" | "other",
  "paper": "e.g. JEE Main 2024, 27 Jan Shift 1 — only if printed on the page, else null",
  "questions": [
    {{
      "number": "the printed question number, as a string",
      "continues_previous": false,
      "cut_off": false,
      "kind": "mcq" | "numerical",
      "body": "the question text",
      "options": ["A text", "B text", "C text", "D text"] or null for numerical,
      "answer": "A" | "B" | "C" | "D" | a number | null,
      "figures": [{{"box": [x0, y0, x1, y1], "where": "body" | "A" | "B" | "C" | "D"}}],
      "subject": "Physics" | "Chemistry" | "Maths",
      "class": 11 | 12,
      "chapter": "exactly one name from the chapter list below",
      "topic": "a short topic name, or null",
      "year": 2024 or null,
      "shift": "e.g. 27 Jan Shift 1, or null",
      "difficulty": 1-5,
      "confidence": 0.0-1.0
    }}
  ],
  "answer_key": [{{"number": "12", "answer": "B" | a number}}]
}}

Rules:
- Write all mathematics, chemical formulae and units in LaTeX inside $...$ (inline) or $$...$$ (display). Use \\mathrm{{}} for chemical formulae.
- Where a figure appears, put the token [[fig:N]] in the body or in that option's text, N being its index in "figures". Boxes are in thousandths of the page width and height (0-1000), tight around the figure only. Chemical structures drawn as pictures are figures.
- Options labelled (1)(2)(3)(4) or (a)(b)(c)(d) map to A B C D. Remove the label from the option text.
- "answer": only if the answer is printed right beside this question on this page. Never solve the question yourself.
- If the page is an answer key or solutions, fill "answer_key" (from solutions take only the final answer) and leave "questions" empty.
- If a question starts at the top of this page as the continuation of one from the previous page, give only the continuation with "continues_previous": true. If a question is cut off at the bottom, set "cut_off": true.
- Bilingual papers: English only. Skip the Hindi copy of every question.
- Skip instructions, headers, footers, watermarks and advertisements.
- "difficulty": your estimate for a JEE Main aspirant, 1 easy to 5 hard.
- "confidence": how sure you are the text, options and figure boxes are exactly right. Lower it for blurry text, dense notation or figures you could not box.
- "chapter" must be copied exactly from this list:
{chapter_list(subject)}
"""


# ── PDF ────────────────────────────────────────────────────────────────────


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_pages(spec: str | None, total: int) -> list[int]:
    if not spec:
        return list(range(total))
    out: list[int] = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        lo, hi = int(a), int(b or a)
        out.extend(range(max(1, lo) - 1, min(total, hi)))
    return sorted(set(out))


def render(pdf: pdfium.PdfDocument, index: int) -> Image.Image:
    return pdf[index].render(scale=RENDER_SCALE).to_pil().convert("RGB")


def to_data_uri(img: Image.Image, fmt: str = "JPEG", quality: int = 82) -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=quality)
    mime = "image/jpeg" if fmt == "JPEG" else "image/webp"
    return f"data:{mime};base64,{base64.b64encode(buf.getvalue()).decode()}"


def crop_figure(page: Image.Image, box: list[float]) -> str | None:
    try:
        x0, y0, x1, y1 = (max(0.0, min(1000.0, float(v))) for v in box)
    except (TypeError, ValueError):
        return None
    if x1 - x0 < 8 or y1 - y0 < 8:
        return None
    w, h = page.size
    pad = 6
    crop = page.crop((int(x0 / 1000 * w) - pad, int(y0 / 1000 * h) - pad, int(x1 / 1000 * w) + pad, int(y1 / 1000 * h) + pad))
    if crop.width > FIGURE_MAX_WIDTH:
        crop = crop.resize((FIGURE_MAX_WIDTH, round(crop.height * FIGURE_MAX_WIDTH / crop.width)))
    return to_data_uri(crop, "WEBP", 80)


# ── The model ──────────────────────────────────────────────────────────────


@dataclass
class Usage:
    prompt: int = 0
    completion: int = 0
    cached_pages: int = 0

    def cost(self) -> float:
        return self.prompt / 1e6 * PRICE_IN + self.completion / 1e6 * PRICE_OUT


def parse_json(text: str) -> dict:
    text = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    if fence:
        text = fence.group(1)
    return json.loads(text)


def read_page(client: OpenAI, prompt: str, image_uri: str, usage: Usage) -> dict:
    last: Exception | None = None
    for attempt in range(4):
        try:
            res = client.chat.completions.create(
                model=MODEL,
                temperature=0,
                response_format={"type": "json_object"},
                max_tokens=8000,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": [
                        {"type": "text", "text": "Read this page."},
                        {"type": "image_url", "image_url": {"url": image_uri}},
                    ]},
                ],
            )
            if res.usage:
                usage.prompt += res.usage.prompt_tokens
                usage.completion += res.usage.completion_tokens
            return parse_json(res.choices[0].message.content or "{}")
        except Exception as e:  # network, rate limit, malformed JSON: retry with backoff
            last = e
            time.sleep(2 ** attempt * 2)
    raise RuntimeError(f"page failed after retries: {last}")


# ── Assembly ───────────────────────────────────────────────────────────────

LETTERS = {"A": 0, "B": 1, "C": 2, "D": 3, "1": 0, "2": 1, "3": 2, "4": 3}


def to_answer(kind: str, raw) -> dict | None:
    if raw is None or raw == "":
        return None
    if kind == "mcq":
        key = str(raw).strip().strip("()").upper()
        return {"option": LETTERS[key]} if key in LETTERS else None
    try:
        return {"value": float(str(raw).strip())}
    except ValueError:
        return None


FIGURE_WORDS = re.compile(r"\b(figure|fig\.|shown|diagram|graph|circuit|as given)\b", re.I)


@dataclass
class Block:
    """Questions since the last answer key; the next key is joined onto them."""
    questions: list[dict] = field(default_factory=list)
    keyed: bool = False


def assemble(pages: list[tuple[int, dict, Image.Image | None]], subject: str | None) -> tuple[list[dict], dict]:
    blocks: list[Block] = [Block()]
    open_q: dict | None = None
    stats = {"pages": len(pages), "answer_key_pages": 0, "joined_answers": 0, "continuations": 0}
    last_kind = "questions"

    for index, data, img in pages:
        kind = data.get("page_kind", "other")
        if kind in ("answer_key", "solutions"):
            stats["answer_key_pages"] += 1
            target = blocks[-1]
            by_number: dict[str, dict] = {}
            for q in target.questions:
                by_number[str(q["number"]).strip()] = q  # last wins: the nearest question with that number
            for row in data.get("answer_key") or []:
                q = by_number.get(str(row.get("number", "")).strip())
                if q and q.get("answer") is None:
                    a = to_answer(q["kind"], row.get("answer"))
                    if a:
                        q["answer"] = a
                        stats["joined_answers"] += 1
            target.keyed = True
            last_kind = kind
            open_q = None
            continue

        if kind != "questions":
            continue
        # A questions page after a key starts a new block.
        if last_kind in ("answer_key", "solutions"):
            blocks.append(Block())
        last_kind = kind
        paper = data.get("paper")

        for raw in data.get("questions") or []:
            figures = []
            for f in raw.get("figures") or []:
                uri = crop_figure(img, f.get("box")) if img is not None else None
                if uri:
                    figures.append(uri)
            if raw.get("continues_previous") and open_q is not None:
                # Shift this part's figure tokens past the figures already on the question.
                offset = len(open_q["figures"])
                shift = lambda s: re.sub(r"\[\[fig:(\d+)\]\]", lambda m: f"[[fig:{int(m.group(1)) + offset}]]", s or "")
                open_q["body"] = (open_q["body"] + " " + shift(raw.get("body"))).strip()
                if raw.get("options") and not open_q.get("options"):
                    open_q["options"] = [shift(o) for o in raw["options"]]
                open_q["figures"].extend(figures)
                stats["continuations"] += 1
                open_q = open_q if raw.get("cut_off") else None
                continue

            # The declared kind wins: an MCQ cut off before its options is still an MCQ.
            declared = raw.get("kind")
            q_kind = declared if declared in ("mcq", "numerical") else ("mcq" if raw.get("options") else "numerical")
            body = (raw.get("body") or "").strip()
            confidence = raw.get("confidence")
            confidence = max(0.0, min(1.0, float(confidence))) if isinstance(confidence, (int, float)) else 0.5
            # Talks about a figure, has none: never "ready" without a look.
            if FIGURE_WORDS.search(body) and not figures:
                confidence = min(confidence, 0.5)
            q = {
                "number": str(raw.get("number") or "").strip() or None,
                "kind": q_kind,
                "body": body,
                "options": raw.get("options") if q_kind == "mcq" else None,
                "answer": to_answer(q_kind, raw.get("answer")),
                "figures": figures,
                "subject": raw.get("subject") or subject,
                "classId": raw.get("class"),
                "chapter": raw.get("chapter"),
                "topic": raw.get("topic"),
                "year": raw.get("year"),
                "shift": raw.get("shift") or None,
                "difficulty": raw.get("difficulty"),
                "confidence": round(confidence, 2),
                "_page": index + 1,
                "_paper": paper,
            }
            if subject and q["subject"] != subject:
                q["subject"] = subject
            blocks[-1].questions.append(q)
            open_q = q if raw.get("cut_off") else None

    questions = [q for b in blocks for q in b.questions]
    # An MCQ needs four options to be one; anything else is dropped by the importer anyway.
    for q in questions:
        if q["kind"] == "mcq" and (not isinstance(q["options"], list) or len(q["options"]) != 4):
            q["confidence"] = 0.0
    return questions, stats


# ── Main ───────────────────────────────────────────────────────────────────


def main() -> None:
    ap = argparse.ArgumentParser(description="PYQ PDF -> alpha-qbank/1 bundle")
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--subject", choices=list(CHAPTERS), help="the subject, when the whole PDF is one subject (recommended)")
    ap.add_argument("--name", help="what the bank calls this source (default: the file name)")
    ap.add_argument("--pages", help="e.g. 1-20 or 3,5,9-12 (default: all)")
    ap.add_argument("--out", type=Path, help="output path (default: <pdf>.qbank.json next to the PDF)")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        sys.exit("Set DEEPSEEK_API_KEY first (https://platform.deepseek.com/api_keys).")

    pdf_path: Path = args.pdf.expanduser().resolve()
    file_hash = sha256_file(pdf_path)
    pdf = pdfium.PdfDocument(str(pdf_path))
    indexes = parse_pages(args.pages, len(pdf))
    cache = HERE / ".qbank-cache" / file_hash
    cache.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(args.subject)
    prompt_tag = hashlib.sha256(f"{PROMPT_VERSION}{MODEL}{prompt}".encode()).hexdigest()[:10]
    client = OpenAI(api_key=key, base_url=BASE_URL)
    usage = Usage()
    # pdfium is not thread-safe: pages are rendered one at a time, and only the
    # network calls run in parallel.
    render_lock = threading.Lock()

    print(f"{pdf_path.name}: {len(indexes)} of {len(pdf)} pages, model {MODEL}")

    def work(i: int) -> tuple[int, dict]:
        cached = cache / f"p{i + 1:04d}-{prompt_tag}.json"
        if cached.exists():
            usage.cached_pages += 1
            return i, json.loads(cached.read_text())
        with render_lock:
            uri = to_data_uri(render(pdf, i))
        data = read_page(client, prompt, uri, usage)
        cached.write_text(json.dumps(data, ensure_ascii=False))
        return i, data

    results: dict[int, dict] = {}
    failed: list[int] = []
    with futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        jobs = {pool.submit(work, i): i for i in indexes}
        for n, job in enumerate(futures.as_completed(jobs), 1):
            i = jobs[job]
            try:
                _, data = job.result()
                results[i] = data
            except Exception as e:
                failed.append(i + 1)
                print(f"  page {i + 1}: {e}", file=sys.stderr)
            print(f"\r  read {n}/{len(indexes)} pages", end="", flush=True)
    print()

    # Figures are cropped from a fresh render, in page order, single-threaded.
    pages = []
    for i in sorted(results):
        data = results[i]
        needs_img = any(q.get("figures") for q in data.get("questions") or [])
        pages.append((i, data, render(pdf, i) if needs_img else None))

    questions, stats = assemble(pages, args.subject)
    bundle = {
        "format": FORMAT,
        "source": {
            "name": (args.name or pdf_path.stem)[:120],
            "fileHash": file_hash,
            "pages": len(pdf),
            "exam": "mains",
            "extractor": f"{MODEL} · extract.py {PROMPT_VERSION}",
        },
        "questions": [{k: v for k, v in q.items() if not k.startswith("_")} for q in questions],
    }
    out = args.out or pdf_path.with_suffix(".qbank.json")
    out.write_text(json.dumps(bundle, ensure_ascii=False))

    answered = sum(1 for q in questions if q["answer"])
    print(f"{len(questions)} questions · {answered} with answers · {stats['joined_answers']} from answer keys "
          f"· {stats['continuations']} joined across pages · {sum(len(q['figures']) for q in questions)} figures")
    print(f"tokens: {usage.prompt:,} in / {usage.completion:,} out · {usage.cached_pages} pages from cache "
          f"· ≈ ${usage.cost():.3f} at peak price (half off-peak)")
    if failed:
        print(f"failed pages (re-run to retry just these): {failed}", file=sys.stderr)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
