"""Upload the bundles nta.py built into the shared PYQ bank (supabase/pyq.sql).

Needs scripts/pyq/.env (gitignored) with the project's service-role key:

    SUPABASE_SERVICE_ROLE_KEY=eyJ...

(Supabase dashboard → Project Settings → API → service_role. Delete the line
once the load is done.) Run pyq.sql first.

    scripts/pyq/.venv/bin/python -I scripts/pyq/load.py              # every bundle in out/
    scripts/pyq/.venv/bin/python -I scripts/pyq/load.py 2026-0402-S1

Figures go to the private `pyq` bucket as <paper>/<file>, rows are upserted on
NTA's Question ID, so a re-run replaces rather than duplicates. Figures already
uploaded are skipped (the bucket is listed first). Prints one line per paper.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "out"
URL = "https://ipwmgkctxkopuszkuebh.supabase.co"
BUCKET = "pyq"


def env() -> dict:
    vals = dict(os.environ)
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


def call(method: str, path: str, key: str, body: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(f"{URL}{path}", data=body, method=method, headers={
        "apikey": key, "Authorization": f"Bearer {key}", **(headers or {}),
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
        return json.loads(data) if data and r.headers.get("content-type", "").startswith("application/json") else data


def existing(key: str, paper: str) -> set:
    names, offset = set(), 0
    while True:
        rows = call("POST", f"/storage/v1/object/list/{BUCKET}", key,
                    json.dumps({"prefix": paper, "limit": 1000, "offset": offset}).encode(),
                    {"Content-Type": "application/json"})
        names.update(r["name"] for r in rows)
        if len(rows) < 1000:
            return names
        offset += 1000


def upload(key: str, path: str, file: pathlib.Path) -> None:
    for attempt in range(3):
        try:
            call("POST", f"/storage/v1/object/{BUCKET}/{path}", key, file.read_bytes(),
                 {"Content-Type": "image/webp", "x-upsert": "true", "Cache-Control": "max-age=31536000, immutable"})
            return
        except urllib.error.HTTPError as e:
            if attempt == 2:
                raise RuntimeError(f"{path}: HTTP {e.code} {e.read()[:200]!r}")


def load(key: str, folder: pathlib.Path) -> str:
    b = json.loads((folder / "bundle.json").read_text())
    paper = b["paper"]
    have = existing(key, paper)
    todo = [f for q in b["questions"] for f in q["figures"] if f not in have]
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda f: upload(key, f"{paper}/{f}", folder / f), todo))
    rows = [{
        "nta_id": q["ntaId"],
        "paper": paper,
        "exam_date": b["date"],
        "shift": b["shift"],
        "number": q["number"],
        "kind": q["kind"],
        "subject": q["subject"],
        "section": q["section"],
        "body": q["body"],
        "options": q["options"],
        "answer": q["answer"],
        "figures": [f"{paper}/{f}" for f in q["figures"]],
        "class_id": q.get("classId"),
        "chapter": q.get("chapter"),
        "confidence": q.get("confidence"),
    } for q in b["questions"]]
    call("POST", "/rest/v1/pyq_questions?on_conflict=nta_id", key, json.dumps(rows).encode(), {
        "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal",
    })
    answered = sum(1 for q in b["questions"] if q["answer"])
    return f"{len(rows)} questions ({answered} answerable), {len(todo)} figures uploaded"


def main(argv: list) -> int:
    key = env().get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print("No SUPABASE_SERVICE_ROLE_KEY in scripts/pyq/.env")
        return 1
    folders = sorted(p for p in OUT.iterdir() if (p / "bundle.json").exists())
    if argv:
        folders = [p for p in folders if p.name in argv]
    failed = 0
    for folder in folders:
        try:
            print(f"ok     {folder.name}: {load(key, folder)}", flush=True)
        except urllib.error.HTTPError as e:
            failed += 1
            print(f"FAIL   {folder.name}: HTTP {e.code} {e.read()[:300]!r}", flush=True)
        except Exception as e:
            failed += 1
            print(f"FAIL   {folder.name}: {str(e)[:300]}", flush=True)
    print(f"\n{len(folders) - failed} papers loaded, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
