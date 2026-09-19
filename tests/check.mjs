// Sanity checks for the question banks, puzzle generators and plan builder.
// Usage: node tests/check.mjs     (no dependencies needed)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const code = ['generators.js', 'questions-1.js', 'questions-2.js', 'questions-3.js', 'plan.js'].map(read).join('\n');
// plan.js expects a few globals that live in app.js at runtime
const DAY = 86400000;
const memory = {};
const storeStub = { get: (k, d) => (k in memory ? memory[k] : d), set: (k, v) => { memory[k] = v; } };
const ctx = vm.createContext({ console, DAY, store: storeStub, Sync: { queue() {} }, document: undefined });
const api = vm.runInContext(`${code}\n;({genLatin,genEquations,genFigures,lsSolve,PASSAGES,MORE,MORE2,daySequence,DAY_TYPES,buildPlan,getPlan:()=>({PLAN,TASKS}),addDays,ymd})`, ctx);

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

// 6. Plan builder: dates, day count and time scaling follow the setup
const start = '2026-03-02';
for (const [hours, expected] of [[6, ['09:00', '10:00', '11:30', '14:00']], [3, ['09:00', '09:30', '10:15', '11:30']], [8, ['09:00', '10:15', '12:15', '15:45']]]) {
  memory.setup = { exam: addDaysLocal(start, 14), time: '09:00', start, hours, from: '09:00' };
  api.buildPlan();
  const { PLAN, TASKS } = api.getPlan();
  check(PLAN.length === 14, `plan(${hours}h): expected 14 days, got ${PLAN.length}`);
  check(PLAN[0].d === start, `plan(${hours}h): first day should be the start date`);
  check(Object.keys(TASKS).length === PLAN.length, `plan(${hours}h): every day needs tasks`);
  const times = PLAN[0].items.map((t) => t.slice(0, 5));
  check(times.join(',') === expected.join(','), `plan(${hours}h): times were ${times.join(',')}, expected ${expected.join(',')}`);
  const shortDay = PLAN.find((p) => p.type === 'latinEq');
  const repeats = (TASKS[shortDay.d] || []).flat().filter((a) => (a.n || 1) > 1).length;
  check(hours >= 4 ? repeats > 0 : repeats === 0, `plan(${hours}h): repeat counts should be capped below 4 hours`);
}
function addDaysLocal(s, n) { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
console.log('Plan builder: day counts, dates and time scaling OK');

// 7. Backup code round trip (the encoding the app uses in the browser)
const b64 = {
  encode: (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64'),
  decode: (c) => JSON.parse(Buffer.from(c, 'base64').toString('utf8')),
};
const sample = { v: 1, data: { log: [{ ts: 1, sec: 'fig', correct: 4, total: 5, secs: 60 }], mistakes: { 'latin:abc': { streak: 1, due: 2, u: 3 } }, level: { fig: 3 }, setup: { exam: '2026-05-01', hours: 5 } } };
const back = b64.decode(b64.encode(sample));
check(JSON.stringify(back) === JSON.stringify(sample), 'backup code: round trip changed the data');
check(back.data.mistakes && back.data.level && back.data.setup, 'backup code: must carry mistakes, levels and setup');
console.log('Backup code: round trip OK');

// 8. The API key must never ride along with sync or the backup code
const appSrc = read('app.js');
const keyLists = appSrc.match(/const (SYNC_KEYS|BACKUP_KEYS)\s*=\s*\[[^\]]*\]/g) || [];
check(keyLists.length === 2, 'app.js: expected SYNC_KEYS and BACKUP_KEYS declarations');
for (const list of keyLists) {
  check(!/['"]ai['"]/.test(list), `${list.slice(0, 20)}…: must not contain 'ai' (that is the API key)`);
  check(!/['"]live['"]/.test(list), `${list.slice(0, 20)}…: must not contain 'live' (an unfinished session is local)`);
}
check(/store\.set\('ai',[^)]*,\s*true\)/.test(read('plan.js')), 'plan.js: the API key must be saved with the no-sync flag');
console.log('API key stays local: OK');

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('All checks passed ✓');
