// Validate a proposed Subject Module text and append it to src/questions-3.js.
// Usage: node tools/import-question.mjs path/to/question.json
//
// The JSON is the same object shape as the bank entries:
// { id, area, title, domain, text, qs: [{ t, q, o, a, e, tip }] }
// The tool checks the shape, refuses duplicate ids, appends the entry, then
// rebuilds and runs the full test suite. If the checks fail, it restores the
// file so a bad entry never lands.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AREAS = new Set(['math', 'stats', 'phys', 'chembio', 'econ', 'biz', 'cs', 'soc']);
const TYPES = new Set(['calc', 'data', 'concept', 'multi', 'except', 'transfer']);
const FILE = resolve(ROOT, 'src/questions-3.js');

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const words = (html) => html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').split(/\s+/).filter(Boolean).length;
const DANGER=/<\s*\/?\s*(script|style|iframe|object|embed|form|input|button|img|base|meta|link)\b|\son[a-z]+\s*=|javascript\s*:/i;
const danger = (s,label) => { if (DANGER.test(s||'')) fail(`${label} must not contain scripts, forms, images or event handlers`); };

const input = process.argv[2];
if (!input) fail('Usage: node tools/import-question.mjs path/to/question.json');

let raw;
try { raw = JSON.parse(readFileSync(input, 'utf8')); }
catch (e) { fail(`Could not read ${input}: ${e.message}`); }

const p = raw.passage || raw;
if (!p || typeof p !== 'object' || Array.isArray(p)) fail('Expected one passage object (or { passage: … }).');
if (!/^[a-z0-9-]+$/.test(p.id || '')) fail('id must contain only lowercase letters, digits and dashes');
if (!AREAS.has(p.area)) fail(`area must be one of: ${[...AREAS].join(', ')}`);
if (!p.title || !p.domain) fail('title and domain are required');
danger(p.text, 'the passage');
if (typeof p.text !== 'string' || !p.text.trim()) fail('text is required');
const count = words(p.text);
if (count < 120) fail(`text is too short (${count} words); aim for 150–250`);
if (count > 320) fail(`text is too long (${count} words); aim for 150–250`);
if (count < 150 || count > 250) console.warn(`! text is ${count} words; the guide asks for 150–250`);

if (!Array.isArray(p.qs) || p.qs.length !== 6) fail('write exactly 6 questions');
p.qs.forEach((q, i) => {
  const n = i + 1;
  if (!TYPES.has(q.t)) fail(`q${n}: t must be one of ${[...TYPES].join(', ')}`);
  danger(q.q, `q${n}`); danger(q.e, `q${n} explanation`); danger(q.tip, `q${n} trick`); q.o.forEach((o, j) => danger(o, `q${n} option ${j + 1}`));
  if (!q.q || typeof q.q !== 'string') fail(`q${n}: question text is required`);
  if (!Array.isArray(q.o) || q.o.length !== 4) fail(`q${n}: exactly 4 options are required`);
  if (new Set(q.o.map(String)).size !== 4) fail(`q${n}: options must all be different`);
  if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) fail(`q${n}: a must be the 0-based index of the answer`);
  if (!q.e || !q.tip) fail(`q${n}: e (explanation) and tip (trick) are required`);
});

const bank = ['questions-1.js', 'questions-2.js', 'questions-3.js', 'questions-4.js']
  .map((f) => readFileSync(resolve(ROOT, 'src', f), 'utf8')).join('\n');
const ids = [...bank.matchAll(/\bid\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
if (ids.includes(p.id)) fail(`id "${p.id}" is already in the bank`);

const original = readFileSync(FILE, 'utf8');
const cut = original.lastIndexOf('\n];');
if (cut < 0) fail('Could not find the end of the MORE2 array in src/questions-3.js');
const pretty = JSON.stringify(p, null, 1);
const next = original.slice(0, cut).trimEnd() + ',\n' + pretty + original.slice(cut);
writeFileSync(FILE, next);

const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
try {
  run('node', ['build.mjs']);
  run('node', ['tests/check.mjs']);
} catch {
  writeFileSync(FILE, original);
  try { run('node', ['build.mjs']); } catch {}
  fail('The entry did not pass the checks. src/questions-3.js was restored and nothing was added.');
}

console.log(`\nAdded "${p.id}" to src/questions-3.js and rebuilt.`);
console.log('Review the diff, then commit src/, index.html and sw.js.');
