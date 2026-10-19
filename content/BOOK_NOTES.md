# LOCK IN. — conversion notes

Source: `Chapter One-1.pdf.pdf` (Canva export, 52 pages: cover, index, Introduction through Chapter 8, the bonus chapter, For Parents, Resources and the sneak peek). The text lives in `content/bookText.ts`; read it in the app at `http://localhost:3000/?book=debug` (dev server, `&ch=N&theme=light` to jump).

The converted text was checked word for word against the PDF's own text layer, with spaces and punctuation stripped so only real wording differences could show. None remain.

## Repaired (formatting damage only)

- **Words run together**, about 40 places, mostly in the later chapters. For example "Atthestartof thisbook, Rahul waseverywhere.Hismediocrity", "ruinanentiregenerationofmenandleave", "Ifyour son gaveyouthis bookandaskedyoutoreadthissection", "builtoncorepillars", "Mostpeople … howmuch … overour desks,glued", "pointonward, thechapterswill beshorter", "Bythis … haveasolid", "thegrind,thenextproject", "mindwhen", "inschools", "spinestraight", "Yourself improvement" → "Your self improvement".
- **Doubled letters** from the PDF's text layer: "fiinal", "benefiits", "Netfllix", "fllabby", "profiile" and others. These only existed in the copyable text; the printed pages were fine.
- **Stray spaces before punctuation**: "bullshit .", "successful .", "admit .", "girl .", "Step 1 :".
- **Sentences broken mid-line** by Canva text boxes ("If I / did / have it", "Read this / book", "Then, / read and apply") were rejoined. Lines you clearly meant as separate paragraphs stay separate.
- **Page 45 was out of order** in the PDF's text (the quotes were stored after the sentences around them). It now reads as printed.
- **Dashes that went missing**, for example "It's a blueprint a guide to…", "building muscle it affects your mood", "Purpose isn't something you FIND it's something you BUILD". These are now em dashes (—), 71 in all. They were missing from the printed PDF too, so this is the one change you might not expect. If any of them reads wrong to you, it is a one-character fix.
- **Typography**: straight quotes made curly, "..." made a single ellipsis "…" (your two-dot ".." is kept everywhere), "---->" in the breathing loop drawn as "→".
- **Kept from the PDF**: italics (*the deed*, *(no shit, sherlock)*, the Deep Work quote, *trying*, *does not*, *bled*, *bang*, …), bold names in Resources, nested workout lists, numbered questions in Purpose.

## Not changed: typos to look at

Your wording was left exactly as written. These look like typos. Say which to fix and they're one-line edits.

| Where | As written | Probably |
|---|---|---|
| Ch 1 | a chocolate chip cookie as **desert** | dessert |
| Ch 1 | to **forsee** what happened | foresee |
| Ch 1 | Rahul **re assures** himself | reassures |
| Ch 1 | Instant **Gratificational activties** | Instant-gratification activities |
| Ch 1 | **You** parents and people around you | Your parents |
| Ch 1 | take one thing **form** this ENTIRE BOOK | from |
| Ch 1 | Close your mouth, **breath** through your nose | breathe |
| Ch 2 | dietary habits **at in** our age group | in our age group |
| Ch 2 | due to **it's** association | its |
| Ch 4 | coined the term, **Carl** Newport | Cal Newport (correct later in the chapter) |
| Ch 4 | **The two terms above** are so crucial | only one term ("Deep Work") is above |
| Ch 5 | **You** actions follow your identity | Your actions |
| Index/Ch 8 | **Chapter 8** follows Chapter 6 | there is no Chapter 7 |
| Resources | views on life as **man** | as a man |

## Decided for the app, easy to change

- **Author name** shown in the app: "Shreyash Mishra" (`content/book.ts`). The PDF has no byline.
- **Chapter labels**: "Introduction", "Bonus chapter", "Extra" (For Parents), "Resources", "Bonus" (sneak peek). These are app labels, not book text.
- **Level 2.** opens before Chapter 3 as a part page, with its short intro.
- **The cover's tagline** ("Not your average "self-development" book.") and subtitle are in `BOOK`, ready for the reader's cover.
- The **index page** isn't carried over; the app builds its own contents from the chapters.
