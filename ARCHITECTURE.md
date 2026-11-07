# How it works

A tour of the code, for anyone who wants to change it. There is no framework, no bundler and no dependencies — `build.mjs` concatenates `src/` into `index.html`, and the browser does the rest.

## The shape of it

```
src/generators.js         puzzle generators (Latin squares, equations, figures)
src/questions-1/2/3/4.js  the Subject Module bank (43 texts, 258 questions)
src/plan.js               exam setup → study plan; the Settings view
src/i18n.js              English/German interface strings and the t()/tf() helpers
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
| `skin`, `lang`, `examday`, `prsel` | theme, interface language, exam-day mode, last practice selection |
| `live` | an unfinished session, so it can be resumed after a reload |
| `ai` | the optional provider settings and API key |

The interface language is stored as `lang` and travels with the theme. `src/i18n.js` holds `STRINGS` (an `en` and a `de` text per key), `t(id)` and `tf(id, vars)`; `applyLang()` rewrites the shell's `data-i18n` elements and the active view is re-rendered, and `buildPlan()` runs on a switch so the day-by-day plan is generated in the new language too. Missing keys fall back to English, then to the key itself. Plan templates, action labels, progress and practice labels, the results screen, the trick deck (`TRICK_DE`, `TYPE_TIP_DE` in `subjects-and-tricks.js`) and the author view are all bilingual. The Subject Module texts and questions stay English on purpose — the real module is in English.

Two lists in `app.js` decide what travels: `SYNC_KEYS` (synced to the Claude account when the page runs as an artifact) and `BACKUP_KEYS` (the backup code). **`ai` and `live` are in neither** — the API key stays in the browser that entered it, and a half-finished session is local by nature. `tests/check.mjs` fails if that ever changes.

## A session

`newSession({ kind, drill, exam, parts })` starts one. A *part* is one section: items, a time limit, and the answers collected so far. The same engine serves practice sets, the mistake bank, subject tests and mock exams — a mock is just several parts in a row with a break in between.

- **Items** are plain objects. Generated ones (`type: 'latin' | 'eq' | 'fig'`) carry their own solution and explanation; subject ones (`type: 'subj'`) point back into the question bank.
- **Rendering** is a full re-render: `renderSession()` builds a template string, `bindView()` attaches one click handler. Event targets are identified by `data-` attributes, which is also how the keyboard shortcuts work — they find the matching button and click it.
- **Saving** happens on every answer (`saveLive`), so a reload can restore the session with its remaining time.
- **Finishing** (`finishPart`) scores the part, writes the logs, updates the mistake bank and the adaptive level, then either starts the next part or shows the results.

## Difficulty and the adaptive level

`low`, `medium` and `high` are passed straight to each core generator, so they change the item, not a label:

- **Latin Squares:** the solution needs 1 / 2–4 / 5–12 deduction steps, and the grid leaves 12–17 / 10–14 / 8–12 givens.
- **Equations:** 2 / 3 / 4 unknowns. Low may include one single-variable equation; medium and high require every equation to have more than one unknown; high also requires the first equation to have three or more. Every system is brute-forced to exactly one solution in 1–20.
- **Figure Sequences:** 1–2 / 2–3 / 3–4 moving figures, and 0 / 0–1 / 1–2 extras (rotation or colour). High also forces an *x + 1* rule 70% of the time. Movement is a line, a diagonal, a border walk (step 1, 2 or *x + 1*) or a repeating four-direction cycle; rotation is fixed or *x + 1*; colour cycles through two or three colours.

`mixed` is not a generator level. `mixedDiffs(n)` gives the first 30% of a set low items, the next 35% medium and the rest high, so a set walks from easier to harder. Mocks use `mixed` for all three core sections.

`adaptive` also builds a per-set difficulty list, from the section's saved level: level 1 is 50% low / 40% medium / 10% high, level 2 is 30/35/35 and level 3 is 10/30/60. After an adaptive set, `finishPart` compares correct ÷ total: 85% or better moves that section up (max 3), below 60% moves it down (min 1), and anything between stays. Levels live in `level`, default to 2, and are per core section — changing one does not touch the other two. Only adaptive sets change a level.

The mistake bank is independent of difficulty: every answered item in any practice, mock, drill or bank session passes through `recordOutcome`, so a wrong item enters `mistakes` whatever level produced it. The bank brings an item back after a day, requires two correct answers in a row to clear it, and keeps at most 15 items per core section. Clearing the bank does not reset the adaptive level.

## The study plan

`buildPlan()` in `plan.js` reads `setup` and produces `PLAN` (days with human-readable steps) and `TASKS` (the same steps as actions). `daySequence(n)` chooses which day templates a plan of *n* days should contain; `DAY_TYPES` holds the templates, with each step's offset in minutes from the start of the study block, scaled to the person's daily hours. The Today screen maps each action to a real session through `runTask`.

## The Subject Module, and why there is nothing to narrow down

The official preparatory materials state that the topics in the exam "cover a
variety of areas including mathematics, computational sciences, natural
sciences, engineering, business administration, economics, social sciences and
humanities", and that for the current India intake there is no subject
specialisation — every candidate sits the same General Academic Module. The
eight areas in `AREAS` are that sentence, so none of them can be ruled out.

What makes the module tractable is that every text is self-contained: the rule,
formula or definition a question needs is printed in the text. The transferable
skill is therefore the *question type*, not the topic, which is why the practice
screen offers three axes:

- `sview: 'area'` — one text end to end, timed like the real thing;
- `sview: 'type'` — `typePool(t)` gathers every non-mock question of one type
  across all eight areas;
- `sview: 'weak'` — `weakPool(n)` scores each question by `1 − accuracy` of its
  area plus `1 − accuracy` of its type, treats anything with fewer than three
  answers as 0.5 (unknown, not safe), adds 0.4 for a question never answered and
  a little jitter, then takes the top n.

`accBy(key)` reads those accuracies straight out of `qlog`, so the Progress
breakdown and the weakest-first drill can never disagree.

## Adding things

- **A subject text:** see CONTRIBUTING.md.
- **A trick card:** append to `TRICKS` in `subjects-and-tricks.js`. Cards are addressed by index, so add at the end — inserting in the middle shifts everyone's saved progress.
- **A day type:** add to `DAY_TYPES` and place it in `daySequence`.
- **A new provider for explanations:** add an entry to `AI_PROVIDERS` in `ai.js` with a `call(cfg, prompt)` that returns text.

After any change: `npm test` (that is `node build.mjs`, `node tests/check.mjs` and `node tests/smoke.mjs`), then commit `src/` together with the rebuilt `index.html` and `sw.js`. CI runs the same and also fails a stale build.

`tests/check.mjs` is a dependency-free VM harness covering bank shape, both generators, the planner, i18n key coverage, and contributed-content sanitising. `tests/smoke.mjs` boots the real app in a minimal DOM stub — it renders every tab in both languages, asserts the trick deck and backup round-trip, and exists so CI needs no browser download. `tools/axe-audit.mjs` (manual, network-fetching axe-core on first run) audits every view with axe.
