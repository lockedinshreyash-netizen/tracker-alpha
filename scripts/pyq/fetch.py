"""Download every JEE Main B.Tech shift of 2024-2026 and NTA's final answer keys.

Papers are NTA's own CBT exports: the master paper for a shift, or a candidate's
response sheet for it (same question and option ids, and the same images). Most
are fetched from jee-main.in, a mirror of NTA's PDFs; April 2026 from NTA itself.
Keys are NTA's final answer keys (one per session, or one per shift in 2026),
from NTA's CDN, the Internet Archive's copy of jeemain.nta.ac.in, or the mirror.

Writes into scripts/pyq/papers/ (gitignored). Re-running skips files already
there. Prints one line per file and a summary. Nothing here reads a PDF.

    scripts/pyq/.venv/bin/python -I scripts/pyq/fetch.py
"""

import json
import pathlib
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "papers"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

MIRROR = "https://jee-main.in/wp-content/uploads"
NTA_CDN = "https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads"
ARCHIVE = "https://web.archive.org/web/2024id_/https://jeemain.nta.ac.in/images"

MON = {1: "Jan", 2: "Feb", 4: "Apr"}

# (year, month, day, shifts) for every B.Tech paper sat.
SHIFTS = [
    (2024, 1, 27, (1, 2)), (2024, 1, 29, (1, 2)), (2024, 1, 30, (1, 2)), (2024, 1, 31, (1, 2)), (2024, 2, 1, (1, 2)),
    (2024, 4, 4, (1, 2)), (2024, 4, 5, (1, 2)), (2024, 4, 6, (1, 2)), (2024, 4, 8, (1, 2)), (2024, 4, 9, (1, 2)),
    (2025, 1, 22, (1, 2)), (2025, 1, 23, (1, 2)), (2025, 1, 24, (1, 2)), (2025, 1, 28, (1, 2)), (2025, 1, 29, (1, 2)),
    (2025, 4, 2, (1, 2)), (2025, 4, 3, (1, 2)), (2025, 4, 4, (1, 2)), (2025, 4, 7, (1, 2)), (2025, 4, 8, (2,)),
    (2026, 1, 21, (1, 2)), (2026, 1, 22, (1, 2)), (2026, 1, 23, (1, 2)), (2026, 1, 24, (1, 2)), (2026, 1, 28, (1, 2)),
    (2026, 4, 2, (1, 2)), (2026, 4, 4, (1, 2)), (2026, 4, 5, (1, 2)), (2026, 4, 6, (1, 2)), (2026, 4, 8, (2,)),
]

# NTA's own links for April 2026 (jeemain.nta.nic.in, "Question Papers").
NTA_2026_APR = {
    "2026-0402-S1": "2026/04/202604092096865379.pdf",
    "2026-0402-S2": "2026/04/20260409481957146.pdf",
    "2026-0404-S1": "2026/04/202604091916616339.pdf",
    "2026-0404-S2": "2026/04/20260409432593766.pdf",
    "2026-0405-S1": "2026/04/20260409828731207.pdf",
    "2026-0405-S2": "2026/04/20260409829414602.pdf",
    "2026-0406-S1": "2026/04/202604092007095665.pdf",
    "2026-0406-S2": "2026/04/20260409725707538.pdf",
    "2026-0408-S2": "2026/04/20260409932754345.pdf",
}

SESSION_KEYS = {
    "key-2024-s1.pdf": f"{ARCHIVE}/Final_Answer_Key_P1_12022024.pdf",
    "key-2024-s2.pdf": f"{ARCHIVE}/FINAL_ANSWER_KEY_JEE_MAIN_SESSION_2_22.04.2024.pdf",
    "key-2025-s1.pdf": f"{NTA_CDN}/2025/02/2025021039.pdf",
    "key-2025-s2.pdf": f"{NTA_CDN}/2025/04/2025041892.pdf",
}


def ordinal(d: int) -> str:
    return f"{d}{'th' if 11 <= d % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(d % 10, 'th')}"


def paper_urls(y: int, m: int, d: int, s: int) -> list:
    pid = f"{y}-{m:02d}{d:02d}-S{s}"
    if pid in NTA_2026_APR:
        return [f"{NTA_CDN}/{NTA_2026_APR[pid]}"]
    if y == 2026:
        month = "Jan" if m == 1 else "April"
        base = f"{MIRROR}/2026/07/JEE-Main-2026-{ordinal(d)}-{month}-Shift-{s}"
        return [f"{base}.pdf", f"{base}-.pdf"]
    return [f"{MIRROR}/2026/01/BTech-{d}-{MON[m]}-{y}-S{s}.pdf"]


def key_urls(y: int, m: int, d: int, s: int) -> list:
    """2026 keys are published one per shift."""
    return [f"{MIRROR}/2026/05/{d}-{MON[m]}-Shift-{s}.pdf"]


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def fetch(name: str, urls: list) -> str:
    dest = OUT / name
    if dest.exists() and dest.stat().st_size > 0:
        return "have"
    for url in urls:
        for attempt in range(3):
            try:
                data = get(url)
                if data[:4] != b"%PDF":
                    break
                dest.write_bytes(data)
                return "ok"
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    break
                time.sleep(2 + attempt * 3)
            except Exception:
                time.sleep(2 + attempt * 3)
    return "MISSING"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest, missing = [], []
    for name, url in SESSION_KEYS.items():
        st = fetch(name, [url])
        print(f"{st:7} {name}")
        if st == "MISSING":
            missing.append(name)
    for y, m, d, shifts in SHIFTS:
        for s in shifts:
            pid = f"{y}-{m:02d}{d:02d}-S{s}"
            st = fetch(f"{pid}.pdf", paper_urls(y, m, d, s))
            key = f"key-{pid}.pdf" if y == 2026 else f"key-{y}-s{1 if m <= 2 else 2}.pdf"
            kst = fetch(key, key_urls(y, m, d, s)) if y == 2026 else "session"
            print(f"{st:7} {pid}  key:{kst}")
            if st == "MISSING":
                missing.append(pid)
            if kst == "MISSING":
                missing.append(key)
            manifest.append({"id": pid, "paper": f"{pid}.pdf", "key": key, "year": y, "date": f"{y}-{m:02d}-{d:02d}", "shift": s})
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"\n{len(manifest)} shifts, {len(missing)} missing: {' '.join(missing) or '-'}")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
