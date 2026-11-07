# Changelog

All notable changes to the dMAT Drill Room. Dates are in ISO format.

## [Unreleased]

### Added
- **Download backup file** and **Import file** on both the first screen and Settings: a dated JSON file carrying the same progress as the backup code, so a backup can be kept outside the clipboard.
- Five more Figure Sequences trick cards: border walks with step 2, the running turn of an *x + 1* rotation, bounce versus wrap, finding the figure the options disagree on, and two- versus three-colour cycles.
- More varied generated Figure Sequences: a figure can stay still for one image, rotations can advance by a fixed step (including *x + 1*), line and diagonal movers can bounce instead of wrapping, and some rotation rules start one image late. The explanation text names the rule that was used.
- A **German interface** next to the theme picker. The setup screen, Today, Practice, Results, Progress, Tactics and the trick-card controls are translated, the choice is stored as `lang` and synced like the theme, and English remains the fallback. Subject texts, questions and trick-card copy stay English on purpose.
- One Statistics text on standard error and sample size (6 questions), bringing the Subject Module bank to 43 texts / 258 questions.
- An **Adaptive difficulty** section in ARCHITECTURE.md explaining what low/medium/high change in each generator, what Mixed and Adaptive contain, and how the mistake bank relates to levels.
- A **New subject text** issue form for contributors who do not write JavaScript, plus `tools/import-question.mjs` to validate a JSON text, append it to the bank, rebuild and run the checks, restoring the file if anything fails.

## [1.3.0] — 2026-09-21

### Added
- Three ways to practise the Subject Module, chosen with a **Practise by** switch: by subject (unchanged), by **question type** (one type mixed across all eight areas, 8 or 16 questions), and **weakest first** (questions drawn from the areas and types you score lowest on).
- Four new texts modelled on the archetypes in the official preparatory materials: vector calculations, hydrostatics, optimal order quantity and research strategies in the social sciences. The bank is now 42 texts / 252 questions.
- A **Drill your weakest spots** button on the Progress breakdown, and three trick cards on what the module actually tests.
- Checks for the question-type pools and the archetype texts.

### Changed
- The question-type drill is no longer buried under the subject list; it is a first-class mode with per-type accuracy shown on each card.
- The Progress breakdown and the weakest-first drill share one `accBy()` helper, so they read the same numbers.

### Fixed
- A resumed session is re-saved immediately, so a second reload no longer loses it.
- Timed sessions snapshot the remaining time when the page is hidden or closed, and every 10 seconds while active.
- The first screen offers **Import code**, and an imported backup restores the exam setup it carries instead of dropping it.

## [1.2.0] — 2026-09-19

### Added
- **"Explain it differently" for everyone.** Bring your own API key in ⚙ Settings — Anthropic, or any OpenAI-compatible endpoint including a local model — and every explanation gets a second-explanation button. A **Test it** button checks the setup and reports refused keys, wrong models and CORS problems in plain words.
- The key is stored in this browser only: it is excluded from the backup code and from account sync, and a check in the test suite keeps it that way.

### Changed
- The explanation code moved into its own file, `src/ai.js`, with three modes: Claude artifact, your own key, or off.
- Every file in `src/` now opens with a header explaining what it holds, and ARCHITECTURE.md documents state, the session engine, the plan builder and how to extend each part.

## [1.1.0] — 2026-09-19

### Added
- **Installable and offline.** A web app manifest, icons and a service worker: add the Drill Room to a phone's home screen and keep studying without a connection. The app checks the network first, so a new version arrives as soon as you are online, with a "new version ready" reload bar.
- **Resume an interrupted session.** Answers, flags, per-question times and the remaining time survive a reload for up to six hours.
- **Printable study plan.** A "Print this plan" button and a print stylesheet: one block per day, black on white.
- **Accessibility.** Answer options are real radio groups, the timer announces five minutes and one minute left, moving between questions moves focus, and the selected figure option carries a checkmark rather than colour alone. Plus a skip-to-content link.

### Changed
- **The backup code now carries everything**: mistake bank, adaptive levels, plan ticks, exam setup and exam-day mode. It is versioned, merges on import instead of overwriting, and still accepts codes made by version 1.0.0.
- Progress is trimmed in the browser as well as when syncing (1,000 questions, 500 sessions), and a refused save now warns you instead of failing silently.
- "Reset all progress" also clears exam-day mode and any unfinished session.

### Fixed
- Charts inside subject texts were squashed to a fraction of their size.

## [1.0.0] — 2026-09-17

First public release: study plan built around your exam date, generated Figure Sequences, Mathematical Equations and Latin Squares, 38 subject texts with 228 questions, two mock exams, mistake bank, pacing feedback, trick cards with spaced repetition, adaptive difficulty, exam-day mode and four themes.
