# How it works

A tour of the code, for anyone who wants to change it. There is no framework, no bundler and no dependencies — `build.mjs` concatenates `src/` into `index.html`, and the browser does the rest.

## The shape of it

```
src/generators.js         puzzle generators (Latin squares, equations, figures)
src/questions-1/2/3.js    the Subject Module bank (38 texts, 228 questions)
src/plan.js               exam setup → study plan; the Settings view
src/app.js                storage, sync, the session engine, most views
src/subjects-and-tricks.js areas, question types, trick cards
src/ai.js                 optional "Explain it differently" providers
src/features.js           mistake bank, Today screen, shortcuts, pacing, offline
src/styles.html           CSS: tokens, four themes, print styles
src/layout.html           the page shell (header, tabs, footer)
```

`build.mjs` joins them in that order inside one `<script>`, so a later file may use anything an earlier one defines. Nothing is exported or imported; the shared names are the ones listed above.

## State

Everything persistent goes through `store` (a thin `localStorage` wrapper in `app.js`):

| Key | What it holds |
|---|---|
| `setup` | exam date and time, plan start, hours per day, daily start time |
| `log` | one row per finished timed or mock section (capped at 500) |
| `qlog` | one row per answered subject question (capped at 1,000) |
| `mistakes` | the mistake bank, keyed by question or generated item |
| `level` | adaptive difficulty level per core section |
| `cards` | trick card box and due date, for spaced repetition |
| `plandone`, `todaydone` | ticked days and ticked steps |
| `seenP` | last score per subject text |
| `skin`, `examday`, `prsel` | theme, exam-day mode, last practice selection |
| `live` | an unfinished session, so it can be resumed after a reload |
| `ai` | the optional provider settings and API key |

Two lists in `app.js` decide what travels: `SYNC_KEYS` (synced to the Claude account when the page runs as an artifact) and `BACKUP_KEYS` (the backup code). **`ai` and `live` are in neither** — the API key stays in the browser that entered it, and a half-finished session is local by nature. `tests/check.mjs` fails if that ever changes.

## A session

`newSession({ kind, drill, exam, parts })` starts one. A *part* is one section: items, a time limit, and the answers collected so far. The same engine serves practice sets, the mistake bank, subject tests and mock exams — a mock is just several parts in a row with a break in between.

- **Items** are plain objects. Generated ones (`type: 'latin' | 'eq' | 'fig'`) carry their own solution and explanation; subject ones (`type: 'subj'`) point back into the question bank.
- **Rendering** is a full re-render: `renderSession()` builds a template string, `bindView()` attaches one click handler. Event targets are identified by `data-` attributes, which is also how the keyboard shortcuts work — they find the matching button and click it.
- **Saving** happens on every answer (`saveLive`), so a reload can restore the session with its remaining time.
- **Finishing** (`finishPart`) scores the part, writes the logs, updates the mistake bank and the adaptive level, then either starts the next part or shows the results.

## The study plan

`buildPlan()` in `plan.js` reads `setup` and produces `PLAN` (days with human-readable steps) and `TASKS` (the same steps as actions). `daySequence(n)` chooses which day templates a plan of *n* days should contain; `DAY_TYPES` holds the templates, with each step's offset in minutes from the start of the study block, scaled to the person's daily hours. The Today screen maps each action to a real session through `runTask`.

## Adding things

- **A subject text:** see CONTRIBUTING.md.
- **A trick card:** append to `TRICKS` in `subjects-and-tricks.js`. Cards are addressed by index, so add at the end — inserting in the middle shifts everyone's saved progress.
- **A day type:** add to `DAY_TYPES` and place it in `daySequence`.
- **A new provider for explanations:** add an entry to `AI_PROVIDERS` in `ai.js` with a `call(cfg, prompt)` that returns text.

After any change: `node build.mjs && node tests/check.mjs`, then commit `src/` together with the rebuilt `index.html` and `sw.js`. CI checks both.
