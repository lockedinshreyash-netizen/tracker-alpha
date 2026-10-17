# Tracker Alpha: Lock In New Tab

Every new tab: search first, then the student's day as one panel.

- **Search:** a glass bar at the top. Typing anywhere lands in it, and `/` focuses it.
- **The panel:** a fine ring (today's hours against the goal, with the streak inside or the live session clock), the line, one button, and a hairline grid of readouts (today, the week, exam days, firewood) plus the next task.
- **Behind it all:** a faint field of ASCII dots (`ascii.js`). Every click sends a ripple through it.

**Themes** (`palettes.js`), separate from Alpha's own look, are picked from the half-moon button in the top bar: Alpha (follows the computer's light/dark), Paper, Sky, Mint, Lilac, Peach, Sunshine, Bubblegum, Midnight and Forest. A theme changes only the background and the accent (the ring, the button and the ASCII dots); the glass and layout stay the same. The choice is saved on the device and applied before the page paints.

Plain HTML, CSS and JS with no build step: it loads instantly on every tab, and the store reviews exactly the source that ships. Fonts are bundled, so a new tab makes no network request at all.

## Nothing else changes, and it says so

Replacing the new tab can feel like the browser got hijacked, so the extension says what it did and didn't do, at every point a student might wonder:

- **On install**, `background.js` opens `welcome.html` once. It covers:
  - the one thing that changed (the new tab) and what didn't (search, the address bar, bookmarks, history, passwords, other sites, settings);
  - both of Chrome's install warnings, in plain words;
  - the "Change back to Google?" bubble Chrome shows on the first tab (click **Keep it**);
  - how to remove it.
- **On the first new tab**, a one-time note says "Your browser works exactly like before." It goes away on **Got it** (stored as `introSeen`).
- **On every new tab**:
  - the search placeholder reads "Search the web, same as always" (it uses `chrome.search`, the browser's own default engine);
  - the footer says the browser works as before, with Remove;
  - the ••• menu holds "What this extension changes" and "Remove extension". Remove uses `chrome.management.uninstallSelf`, which needs no permission, and Chrome asks the student to confirm.

## How the data gets here

The app writes a small summary of the day to one localStorage key, `alpha_ext_summary_v1` (`install/extensionSummary.ts`), computed with the app's own streak and firewood logic. `content.js` runs on trackeralpha.in only, reads that one key, and copies it into `chrome.storage.local`. The new tab reads it from there and updates live when it changes. **Nothing leaves the device**; the extension has no server, no analytics and no remote code.

If the student hasn't opened Alpha since the 4 AM rollover, the tab projects the summary onto today: today shows 0h, and each fully missed day burns a firewood or ends the streak, until Alpha is opened again and recomputes it properly.

## Build and try it

```bash
npm run extension:build
```

That writes the icons (from `public/icon-512.png`) and `dist-extension/tracker-alpha-extension-<version>.zip`.

To try it unpacked: `chrome://extensions` → Developer mode → Load unpacked → pick the `extension/` folder. Then open trackeralpha.in once so the summary is copied, and open a new tab.

**The design board:** `http://localhost:3000/extension/board.html` (dev server). It has two modes:

- **Student journey:** 14 scenes in the order a student meets them, each with what to look for. They run from the store page and Chrome's install warning to the welcome page, the first tab with Chrome's "Keep it?" bubble, a full day (morning, mid-session, searching, goal hit), the next morning, a missed day with firewood, days away with none, exam week, removing it, and the old new tab coming back. Arrow keys step through.
- **Playground:** sliders for every number: time of day, hours, goal, streak, best, firewood, the session, days since Alpha was opened, exam, tasks and the first-run note.

A theme dropdown, an Alpha Dark/Light switch and three window sizes apply to both modes.

The window is the real `newtab.html` / `welcome.html`, so it shows exactly what ships. Chrome's own dialogs are mocked. The board files are never packed.

For quick single states, the dev server serves the page with fixtures: `http://localhost:3000/extension/newtab.html?demo=full` (also `empty`, `session`, `done`, `holding`, `stale`). With no `demo` it reads the app's summary from the same origin.

## Publishing (Chrome Web Store)

1. Register at the Chrome Web Store developer dashboard (one-time US$5 fee).
2. New item → upload the zip from `dist-extension/`.
3. Listing:
   - **Category:** Productivity. **Language:** English (India).
   - **Short description:** the manifest `description`.
   - **Screenshots:** 1280×800. Use `?demo=full`, `?demo=session` and `?demo=done` from the dev server at that size.
   - **Privacy tab:**
     - Single purpose: "Shows the student's Tracker Alpha day on the new tab page."
     - `storage`: "Keeps the day's summary on the device."
     - `search`: "The search box uses the browser's own default search engine."
     - Host access to trackeralpha.in: "Reads the summary Tracker Alpha writes for this extension, on the student's own device."
     - Data usage: no data is collected or transmitted.
4. Submit for review.

Edge Add-ons takes the same zip. Firefox needs `browser_specific_settings.gecko.id` added to the manifest first.

Bump `version` in `manifest.json` for every upload; the store refuses a repeated version.

## Fonts

Satoshi (Indian Type Foundry, via Fontshare, ITF Free Font License) and Playfair Display italic (Google Fonts, SIL Open Font License), the same faces the app uses.
