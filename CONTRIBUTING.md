# Contributing

Thanks for helping other dMAT candidates. There's no framework and no dependencies — just plain JavaScript.

## Workflow

1. Edit files in `src/`.
2. Rebuild the single-file app: `node build.mjs` (this regenerates `index.html` and `sw.js` — edit `src/sw.template.js`, never `sw.js`).
3. Run the checks: `node tests/check.mjs`.
4. Open `index.html` in a browser and try your change.
5. Commit **both** your `src/` changes and the rebuilt `index.html` / `sw.js`, then open a pull request.

Offline note: the service worker's cache name contains a hash of the built page, so each build replaces the old offline copy and people are offered a reload.

## Adding a subject-module text

Add an object to the array in `src/questions-3.js` (or a new file you register in `build.mjs` and `tests/check.mjs`):

```js
{
  id: 'unique-id',              // letters, digits, dashes
  area: 'econ',                 // math | stats | phys | chembio | econ | biz | cs | soc
  title: 'Short title',
  domain: 'Economics',          // label shown above the text
  text: `<p>The passage. Tables and inline SVG charts are fine.</p>`,
  qs: [
    {
      t: 'calc',                // calc | data | concept | multi | except | transfer
      q: 'Question text',
      o: ['option a', 'option b', 'option c', 'option d'],  // exactly 4, all different
      a: 1,                     // index of the correct option (options are shuffled at runtime)
      e: 'Why the answer is right.',
      tip: 'The reusable trick behind it.'
    }
  ]
}
```

Guidelines:

- **Write original material.** Don't copy official dMAT/TestAS questions or copyrighted texts.
- Every answer must follow from the text plus basic school maths — the real test is about applying what you read.
- Double-check every number. `node tests/check.mjs` validates the structure, not the maths.
- Options shouldn't refer to their position ("both a and b"), because the app shuffles them.

## Other ideas

- **Trick cards:** add to the `TRICKS` array in `src/subjects-and-tricks.js`.
- **Plan templates:** edit `DAY_TYPES` and `daySequence()` in `src/plan.js`.
- **Puzzle generators:** see `src/generators.js`. `tests/check.mjs` verifies that every Latin square has a unique answer and every figure option is distinct.
