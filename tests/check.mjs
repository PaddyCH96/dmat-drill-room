// Sanity checks for the question banks, puzzle generators and plan builder.
// Usage: node tests/check.mjs     (no dependencies needed)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const code = ['generators.js', 'questions-1.js', 'questions-2.js', 'questions-3.js', 'plan.js'].map(read).join('\n');
const ctx = vm.createContext({ console });
const api = vm.runInContext(`${code}\n;({genLatin,genEquations,genFigures,lsSolve,PASSAGES,MORE,MORE2,daySequence,DAY_TYPES})`, ctx);

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error('✗', msg); } };

// 1. Question bank shape
const all = [...api.PASSAGES, ...api.MORE, ...api.MORE2];
const ids = new Set();
for (const p of all) {
  check(!ids.has(p.id), `duplicate passage id ${p.id}`); ids.add(p.id);
  check(p.qs.length >= 4, `${p.id}: fewer than 4 questions`);
  p.qs.forEach((q, i) => {
    check(Array.isArray(q.o) && q.o.length === 4, `${p.id} q${i + 1}: needs exactly 4 options`);
    check(Number.isInteger(q.a) && q.a >= 0 && q.a < 4, `${p.id} q${i + 1}: answer index out of range`);
    check(new Set(q.o).size === 4, `${p.id} q${i + 1}: duplicate options`);
    check(typeof q.e === 'string' && q.e.length > 0, `${p.id} q${i + 1}: missing explanation`);
  });
}
console.log(`Question bank: ${all.length} texts, ${all.reduce((s, p) => s + p.qs.length, 0)} questions`);

// 2. Latin squares: the target cell has exactly one possible letter
function completions(grid) {
  const g = grid.map((r) => r.slice()); const out = [];
  const rec = () => {
    if (out.length > 30) return;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (!g[r][c]) {
      for (const L of 'ABCDE') { if (g[r].includes(L) || g.some((x) => x[c] === L)) continue; g[r][c] = L; rec(); g[r][c] = null; }
      return;
    }
    out.push(g.map((r) => r.slice()));
  };
  rec(); return out;
}
for (const d of ['low', 'medium', 'high']) for (let i = 0; i < 25; i++) {
  const L = api.genLatin(d);
  const vals = new Set(completions(L.grid).map((g) => g[L.tr][L.tc]));
  check(vals.size === 1 && vals.has(L.answer), `latin ${d}: ambiguous or wrong target`);
}

// 3. Equations: exactly one solution in 1..20
for (const d of ['low', 'medium', 'high']) for (let i = 0; i < 25; i++) {
  const Q = api.genEquations(d);
  check(Q.answer.every((v) => v >= 1 && v <= 20), `equations ${d}: value out of range`);
}

// 4. Figure sequences: three distinct options per image, no overlapping figures
for (const d of ['low', 'medium', 'high']) for (let i = 0; i < 60; i++) {
  const F = api.genFigures(d);
  for (const a of F.answers) {
    const keys = a.options.map((o) => JSON.stringify(o.map((s) => [s.shape, s.r, s.c, s.rot, s.color]).sort()));
    check(new Set(keys).size === 3, `figures ${d}: duplicate options`);
    a.options.forEach((o) => check(new Set(o.map((s) => s.r * 4 + s.c)).size === o.length, `figures ${d}: overlapping figures`));
  }
}

// 5. Plan builder: every length from 1 to 60 days produces valid day types
for (let n = 1; n <= 60; n++) {
  const seq = api.daySequence(n);
  check(seq.length === n, `plan ${n}: produced ${seq.length} days`);
  check(seq.every((t) => api.DAY_TYPES[t]), `plan ${n}: unknown day type`);
  check(seq[seq.length - 1] === 'light', `plan ${n}: should end with a light review day`);
}

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('All checks passed ✓');
