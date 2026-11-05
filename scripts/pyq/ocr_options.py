"""OCR the option images of every question (on-device, Apple Vision), cached in
out/<paper>/ocr_opts.json as ntaId -> option texts joined by " | ". Options carry
chapter signal the stem often lacks (units, compounds, curves). Re-runs skip
what is cached. Prints a summary only.

    scripts/pyq/.venv/bin/python -I scripts/pyq/ocr_options.py
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "out"


def main() -> int:
    from ocrmac import ocrmac
    done = 0
    for folder in sorted(p for p in OUT.iterdir() if (p / "bundle.json").exists()):
        cache_file = folder / "ocr_opts.json"
        cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
        b = json.loads((folder / "bundle.json").read_text())
        for q in b["questions"]:
            if q["ntaId"] in cache or not q.get("options"):
                continue
            texts = []
            for opt in q["options"]:
                for i in re.findall(r"\[\[fig:(\d+)\]\]", opt):
                    f = folder / q["figures"][int(i)]
                    texts.append(" ".join(r[0] for r in ocrmac.OCR(str(f), recognition_level="accurate").recognize()))
            cache[q["ntaId"]] = " | ".join(texts)
            done += 1
        cache_file.write_text(json.dumps(cache))
        print(f"{folder.name}: {len(cache)} cached", flush=True)
    print(f"done, {done} new")
    return 0


if __name__ == "__main__":
    sys.exit(main())
