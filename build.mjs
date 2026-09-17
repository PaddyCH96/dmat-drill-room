// Builds the single-file app (index.html) from the sources in src/.
// Usage: node build.mjs      (no dependencies needed)
import { readFileSync, writeFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`./src/${f}`, import.meta.url), 'utf8');

// Script order matters: generators → question banks → plan helpers → app core
// (subjects-and-tricks is spliced in right after the passage index is created) → features.
const app = read('app.js');
const marker = 'const PBY=Object.fromEntries(PASSAGES.map(p=>[p.id,p]));';
if (!app.includes(marker)) throw new Error('build: passage-index marker not found in src/app.js');

const script = [
  read('generators.js'),
  read('questions-1.js'),
  read('questions-2.js'),
  read('questions-3.js'),
  read('plan.js'),
  app.replace(marker, `${marker}\n${read('subjects-and-tricks.js')}`),
  read('features.js'),
].join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
${read('styles.html')}
</head>
<body>
${read('layout.html')}
<script>
${script}
</script>
</body>
</html>
`;
writeFileSync(new URL('./index.html', import.meta.url), html);
console.log(`Built index.html (${(html.length / 1024).toFixed(0)} KB)`);
