// Sanity checks for the question banks, puzzle generators and plan builder.
// Usage: node tests/check.mjs     (no dependencies needed)
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const code = ['generators.js', 'questions-1.js', 'questions-2.js', 'questions-3.js', 'questions-4.js', 'plan.js', 'i18n.js'].map(read).join('\n');
// plan.js expects a few globals that live in app.js at runtime
const DAY = 86400000;
const memory = {};
const storeStub = { get: (k, d) => (k in memory ? memory[k] : d), set: (k, v) => { memory[k] = v; } };
const ctx = vm.createContext({ console, DAY, store: storeStub, Sync: { queue() {} }, document: undefined });
const api = vm.runInContext(`${code}\n;({genLatin,genEquations,genFigures,lsSolve,posAt,stateAt,figDesc,movedSteps,bounceCount,STRINGS,t,tf,PASSAGES,MORE,MORE2,MORE3,OFFICIAL,daySequence,DAY_TYPES,buildPlan,getPlan:()=>({PLAN,TASKS}),addDays,ymd})`, ctx);

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error('✗', msg); } };

// 1. Question bank shape
const all = [...api.PASSAGES, ...api.MORE, ...api.MORE2, ...api.OFFICIAL, ...api.MORE3];
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

// 9. Question types: the drill-by-type mode needs a usable pool of each one,
//    and the type keys used in the banks must match the ones the app defines.
const types = [...read('subjects-and-tricks.js').matchAll(/const QTYPES=\{([^}]*)\}/g)]
  .flatMap((m) => [...m[1].matchAll(/(\w+):'/g)].map((x) => x[1]));
check(types.length === 6, `subjects-and-tricks.js: expected 6 question types, found ${types.length}`);
const byType = {};
for (const p of all) for (const q of p.qs) if (q.t) byType[q.t] = (byType[q.t] || 0) + 1;
for (const t of Object.keys(byType)) check(types.includes(t), `unknown question type "${t}" in the bank`);
for (const t of types) check((byType[t] || 0) >= 8, `question type "${t}": only ${byType[t] || 0} questions, a drill needs at least 8`);
console.log(`Question types: ${types.map((t) => `${t} ${byType[t]}`).join(', ')}`);

// 10. The four texts modelled on the official exercises
const arch = all.filter((p) => p.arch);
check(arch.length === 4, `expected 4 archetype texts (arch: 1), found ${arch.length}`);
check(new Set(arch.map((p) => p.area)).size === arch.length, 'archetype texts must sit in four different subject areas');
for (const p of arch) {
  check(p.qs.length >= 6, `${p.id}: an archetype text needs at least 6 questions`);
  check(p.qs.every((q) => q.t && q.tip), `${p.id}: every archetype question needs a type and a tip`);
}
console.log(`Archetype texts: ${arch.map((p) => p.id).join(', ')}`);

// 11. Session persistence and backup restore wiring
check(/function resumeLive\(\)\{[\s\S]*?session=restored;\s*saveLive\(\);/.test(appSrc), 'app.js: resumeLive must re-save the restored session');
check(/addEventListener\('pagehide',\s*\(\)\s*=>\s*saveLive\(\)\)/.test(appSrc), 'app.js: pagehide must save the live session');
check(/addEventListener\('visibilitychange',\s*\(\)\s*=>\s*\{?\s*if\(document\.visibilityState==='hidden'\)\s*saveLive\(\)/.test(appSrc), 'app.js: hiding the page must save the live session');
check(/if\(o\.setup!=null\)\{ if\(validSetup\(o\.setup\)\)\{store\.set\('setup',o\.setup\)/.test(appSrc), 'app.js: importing a backup must restore a valid exam setup');
console.log('Session persistence and backup restore: OK');

// 12. File backup: download a JSON file and import one back
check(/data-act="download"/.test(read('plan.js')) && /data-act="download"/.test(appSrc), 'backup UI: both the first-run screen and Settings need a download button');
check(/data-act="importfile"/.test(read('plan.js')) && /data-act="importfile"/.test(appSrc), 'backup UI: both screens need an import-file button');
check(/new Blob\(\[json\],\{type:'application\/json'\}\)/.test(appSrc), 'app.js: the backup must download as JSON');
check(/dmat-drill-room-backup-/.test(appSrc) && /\.json`/.test(appSrc), 'app.js: the backup file needs a dated .json name');
check(/function applyBackup\(o\)\{[\s\S]*?return \{n,setupRestored,skipped\};/.test(appSrc), 'app.js: imports should share one applyBackup path');
check(/const bf=\$\('#backupfile'\);[\s\S]*?r\.readAsText\(file\)/.test(appSrc), 'app.js: the file input must read the chosen file');
console.log('File backup and import: OK');

// 13. Non-developer contribution path: an issue form and a validating importer
const formPath = new URL('../.github/ISSUE_TEMPLATE/question.yml', import.meta.url);
const toolPath = new URL('../tools/import-question.mjs', import.meta.url);
check(existsSync(formPath), 'issue template: .github/ISSUE_TEMPLATE/question.yml is missing');
check(existsSync(toolPath), 'importer: tools/import-question.mjs is missing');
if (existsSync(formPath)) {
  const form = readFileSync(formPath, 'utf8');
  check(/name:\s*New subject text/.test(form), 'issue template: needs a title');
  check(['q1', 'q2', 'q3', 'q4', 'q5', 'q6'].every((id) => form.includes(`id: ${id}`)), 'issue template: needs six question fields');
  check(/required: true/.test(form), 'issue template: fields must be required');
}
if (existsSync(toolPath)) {
  const tool = readFileSync(toolPath, 'utf8');
  check(/questions-3\.js/.test(tool), 'importer: should append to src/questions-3.js');
  check(/writeFileSync\(FILE, original\)/.test(tool), 'importer: must restore the file when checks fail');
  check(/tests\/check\.mjs/.test(tool), 'importer: should run the checks after appending');
}
console.log('Non-developer contribution path: OK');

// 14. Figure-sequence variations: still, distance-linked rotation, bounce colour, late rotation
const ring = { kind: 'ring', start: 0, dir: 1, step: 2, desc: 'moves two fields clockwise' };
const stepFig = { shape: 'tri', mover: ring, rot: { dir: 1, mode: 'step' }, baseRot: 0, rotDelay: 2, color: 'black' };
check(api.stateAt(stepFig, 1).rot === 0, 'figures: a late rotation must hold for the first images');
check(api.stateAt(stepFig, 2).rot === 180, 'figures: rotation tied to a two-field move should turn 180°');
check(api.stateAt(stepFig, 3).rot === 0, 'figures: two 180° turns should return to the start');

const line = { kind: 'line', axis: 'h', fixed: 0, start: 0, dir: 1, step: 1, desc: 'moves horizontally' };
const bounceFig = { shape: 'tri', mover: line, rot: null, baseRot: 0, cols: ['black', 'pink'], colMode: 'bounce' };
check(api.stateAt(bounceFig, 2).color === 'black', 'figures: bounce colour should not change before the wall');
check(api.stateAt(bounceFig, 3).color === 'pink', 'figures: bounce colour should change at the wall');
check(api.stateAt(bounceFig, 5).color === 'pink', 'figures: bounce colour should hold between bounces');
check(api.stateAt(bounceFig, 6).color === 'black', 'figures: bounce colour should change on the next bounce');

const still = { kind: 'still', r: 1, c: 2, desc: 'stays in the same field while the other figures move' };
check(JSON.stringify(api.posAt(still, 7)) === '[1,2]', 'figures: a still figure must not move');
check(/stays in the same field/.test(api.figDesc({ shape: 'tri', mover: still, rot: null, color: 'black' })), 'figures: a still figure needs its plain-English line');

const delayed = { shape: 'tri', mover: still, rot: { dir: 1, mode: 1 }, baseRot: 0, rotDelay: 3 };
check(api.stateAt(delayed, 2).rot === 0 && api.stateAt(delayed, 3).rot === 90, 'figures: a delayed rotation starts on the next image');
console.log('Figure-sequence variations: OK');

// 15. Interface language: every string has English and German, and the switch is wired
const strings = Object.entries(api.STRINGS);
check(strings.length >= 60, `i18n: expected a useful string set, found ${strings.length}`);
const missing = strings.filter(([, v]) => !v.en || !v.de).map(([k]) => k);
check(missing.length === 0, `i18n: missing en/de for ${missing.join(', ')}`);
check(api.t('tab.today') === 'Today', 'i18n: t() should return English by default');
check(api.tf('today.due', { due: 2, all: 5 }) === '2 due · 5 total', 'i18n: tf() should fill placeholders');
check(/applyLang\(\)/.test(appSrc), 'app.js: applyLang must run at startup');
check(/class="skins lang"[\s\S]*?data-lang="de"/.test(read('layout.html')), 'layout.html: needs a language switch');
check(/const b=e\.target\.closest\('\[data-lang\]'\)/.test(appSrc), 'app.js: the language buttons need a click handler');
check(/'lang'/.test(appSrc.match(/const SYNC_KEYS\s*=\s*\[[^\]]*\]/)?.[0] || ''), 'app.js: the language choice should sync like the theme');
console.log(`Interface language: ${strings.length} strings in en/de`);

// 16. In-app authoring: the Settings link, the form and the export path (issue 3 step 2)
check(/data-go="author"/.test(read('plan.js')), 'plan.js: Settings should link to the authoring view');
check(/function viewAuthor/.test(appSrc), 'app.js: the in-app authoring view should exist');
check(/function authorProblems/.test(appSrc), 'app.js: the authoring form must validate before export');
check(/function authorExport/.test(appSrc), 'app.js: the authoring form must export JSON');
check(/node tools\/import-question\.mjs/.test(read('i18n.js')), 'i18n.js: the export message should point at the importer');
console.log('In-app authoring: form, checks and export path');

// 17. Figure-sequence generator actually produces the new modes over many draws
{
  const found={still:0,step:0,bounce:0,late:0};
  for(let i=0;i<2500;i++){
    const r=api.genFigures('high');
    for(const x of r.explain){
      if(/stays in the same field/.test(x))found.still++;
      if(/for every field it moves/.test(x))found.step++;
      if(/changes only when it bounces/.test(x))found.bounce++;
      if(/holds its orientation/.test(x))found.late++;
    }
  }
  check(found.still>0,'generator: no still mover produced in 2500 high-difficulty items');
  check(found.step>0,'generator: no field-step rotation produced in 2500 high-difficulty items');
  check(found.bounce>0,'generator: no bounce-only colour change produced in 2500 high-difficulty items');
  check(found.late>0,'generator: no delayed rotation produced in 2500 high-difficulty items');
  console.log(`Figure modes over 2500 items — still ${found.still}, step-rotation ${found.step}, bounce colour ${found.bounce}, delayed rotation ${found.late}`);
}

// 18. Bank content is safe to inject: the author form, the importer and the renderer all guard HTML
{
  const m=appSrc.match(/const safeHTML=.*\n/);
  check(!!m,'app.js: safeHTML must exist');
  if(m){
    const safe=vm.runInNewContext(m[0]+';safeHTML');
    check(!safe('<img src=x onerror=alert(1)>ok').includes('<img'),'safeHTML must drop images');
    check(!safe('<p onerror="alert(1)">ok</p>').includes('onerror'),'safeHTML must strip event handlers');
    check(!safe('<script>alert(1)</script>ok').includes('script'),'safeHTML must drop scripts');
    check(!safe('javascript:alert(1)').includes('javascript:'),'safeHTML must strip javascript: URLs');
    check(safe('a<br>b').includes('<br>'),'safeHTML must keep basic markup');
  }
  check(/DANGER/.test(appSrc),'app.js: the author form must reject dangerous HTML');
  check(/DANGER/.test(readFileSync(toolPath,'utf8')),'importer: the importer must reject dangerous HTML');
}
console.log('Unsafe input handling: renderer, author form and importer');

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('All checks passed ✓');
