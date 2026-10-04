# Question bank extractor

Turns a PYQ PDF into a bundle you import in the app under **Mocks → Question bank → Import bundle**. It runs on your laptop. The app never sees the PDF or the API key.

## One-time setup

```bash
cd scripts/qbank
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DEEPSEEK_API_KEY=sk-...        # https://platform.deepseek.com/api_keys
```

macOS ships Python 3.9; install a newer one with `brew install python@3.12`.

## Run it

Try a sample first and check the result before paying for a whole book:

```bash
python extract.py "~/Downloads/Physics PYQs.pdf" --subject Physics --pages 1-20
```

Then the whole PDF:

```bash
python extract.py "~/Downloads/Physics PYQs.pdf" --subject Physics --name "Physics PYQs 2019-25"
```

It writes `Physics PYQs.qbank.json` next to the PDF. Import that file in the app.

- `--subject`: set it whenever the PDF is one subject. Chapter tagging is much better with it.
- Re-running is free for pages already read. Every page's answer is cached in `.qbank-cache/`, keyed by the PDF's hash and the prompt version.
- The cost estimate at the end uses peak prices. Off-peak and weekends are half price.

## What happens in the app

The importer checks every question:

| Status | When |
|---|---|
| **Ready** | Has an answer, a chapter from our syllabus, and the model was ≥ 85% sure |
| **To check** | Unsure text, a missing figure, or a chapter name we don't have |
| **No answer** | No answer key was found. It can never go into a paper until you add one |

The same question in two PDFs is stored once.

## Notes

- `chapters.json` is the app's own chapter list. Run `npm run qbank:chapters` from the repo root after renaming or adding a chapter in `constants.tsx`.
- To try another model behind an OpenAI-compatible API, set `QBANK_MODEL` and `QBANK_BASE_URL`. The prompt version and model are part of the cache key, so pages are read again under a new model.
