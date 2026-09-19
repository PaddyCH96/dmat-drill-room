# Changelog

All notable changes to the dMAT Drill Room. Dates are in ISO format.

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
