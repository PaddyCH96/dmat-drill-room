// Headless smoke test: runs the real app in a minimal DOM stub and checks
// the views actually render, the language switch works, and the backup path
// merges at runtime (not just by regex).
// Usage: node tests/smoke.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const marker = 'const PBY=Object.fromEntries(PASSAGES.map(p=>[p.id,p]));';
const app = read('app.js').replace(marker, `${marker}\n${read('subjects-and-tricks.js')}`);
const script = [
  read('generators.js'),
  read('questions-1.js'),
  read('questions-2.js'),
  read('questions-3.js'),
  read('questions-4.js'),
  read('plan.js'),
  read('i18n.js'),
  app,
  read('ai.js'),
  read('features.js'),
].join('\n');

const storeMem = {};
const localStorage = {
  getItem: (k) => (k in storeMem ? storeMem[k] : null),
  setItem: (k, v) => { storeMem[k] = String(v); },
  removeItem: (k) => { delete storeMem[k]; },
};
localStorage.setItem('dmat_setup', JSON.stringify({ exam: '2030-01-01', time: '09:00', start: '2026-11-01', hours: 6, from: '09:00' }));
localStorage.setItem('dmat_log', JSON.stringify([{ ts: 1000, sec: 'fig', diff: 'mixed', mode: 'timed', correct: 18, total: 20, secs: 1500, answered: 20 }]));

const makeEl = () => ({
  addEventListener() {}, setAttribute() {}, removeAttribute() {},
  onclick: null, oninput: null, onkeydown: null, onsubmit: null,
  classList: { add() {}, remove() {}, toggle() {} },
  dataset: {}, style: {}, hidden: false,
  textContent: '', innerHTML: '', value: '',
  focus() {}, click() {}, select() {}, closest() { return null; },
});
const viewEl = makeEl();
const tabsEl = { ...makeEl(), hidden: false };
const documentEl = {
  documentElement: { lang: 'en', setAttribute() {}, removeAttribute() {} },
  querySelector(s) {
    if (s === '.skins' || s === '.lang') return makeEl();
    if (s === '#view') return viewEl;
    return null;
  },
  querySelectorAll() { return []; },
  getElementById(id) {
    if (id === 'view') return viewEl;
    if (id === 'tabs') return tabsEl;
    return null;
  },
  createElement() { return makeEl(); },
  addEventListener() {},
  body: makeEl(),
};

const windowSelf = {};
const ctx = vm.createContext({
  console, localStorage, document: documentEl,
  window: Object.assign(windowSelf, {
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    top: windowSelf,
    self: windowSelf,
    __aiItems: [],
  }),
  navigator: {},
  location: { protocol: 'https:', reload() {} },
  setInterval: () => 0, clearInterval() {}, setTimeout, clearTimeout,
  Blob: class {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, FileReader: class {},
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
});

vm.runInContext(script, ctx);

const run = (expr) => vm.runInContext(expr, ctx);
const html = () => viewEl.innerHTML;
const out = (k, v) => console.log(JSON.stringify({ k, v }));
const ok = (cond, msg) => { if (!cond) { console.error('✗', msg); failures++; } };
let failures = 0;

// Boot must have rendered the Today view (English default)
ok(/Mistake bank/.test(html()), 'boot: expected the English Today view');

// English views render with real content
const en = { today: 'Mistake bank', plan: 'day plan', practice: 'Choose a section', mock: 'Mock', progress: 'Timed and mock sessions', tricks: 'Trick cards', guide: 'What you are facing', setup: 'Your exam and study plan' };
for (const [tab, markerText] of Object.entries(en)) {
  vm.runInContext(`setTab(${JSON.stringify(tab)})`, ctx);
  ok(html().includes(markerText), `EN ${tab}: expected "${markerText}"`);
}

// Switch to German; the whole Today view must be German (plan rebuild happens in the click handler, so do it here)
vm.runInContext(`LANG='de'; buildPlan(); applyLang(); render();`, ctx);
const de = { today: 'Fehlerbank', practice: 'Wähle einen Abschnitt', guide: 'Was dich erwartet', tricks: 'Trickkarten', setup: 'Einstellungen' };
for (const [tab, markerText] of Object.entries(de)) {
  vm.runInContext(`setTab(${JSON.stringify(tab)})`, ctx);
  ok(html().includes(markerText), `DE ${tab}: expected "${markerText}"`);
}

// Plan content itself must be German after rebuild
vm.runInContext(`setTab('plan')`, ctx);
ok(!/Your \d+-day plan/.test(html().replace(/\byour\b/i, 'your')), 'DE plan: English "Your N-day plan" should be gone');

// German trick cards: every card needs a front and back
ok(run('TRICKS.every(c=>(c.df||TRICK_DE[c.f])&&(c.db||TRICK_DE[c.f]))')===true, 'de: every trick card needs a German front and back');
vm.runInContext(`setTab('tricks')`, ctx);
ok(/Trickkarten/.test(html()), 'DE tricks: expected the translated tab content');

// Backup round trip at runtime, including the invalid-setup path
const backup = { setup: { exam: '2031-05-01', time: '08:00', start: '2026-12-01', hours: 4, from: '08:00' }, examday: true, log: [{ ts: 2000, sec: 'eq', diff: 'high', mode: 'timed', correct: 19, total: 20, secs: 1400, answered: 20 }] };
vm.runInContext(`globalThis.__r = applyBackup(${JSON.stringify(backup)})`, ctx);
const r = vm.runInContext('JSON.stringify(__r)', ctx);
ok(/"setupRestored":true/.test(r), 'backup: expected setup to be restored');
ok(run('store.get("log", []).length') === 2, 'backup: expected the log row to merge');
ok(run('store.get("examday")') === true, 'backup: expected examday to be restored');
vm.runInContext(`globalThis.__r2 = applyBackup(${JSON.stringify({ setup: { exam: 'garbage' } })})`, ctx);
ok(/"skipped":1/.test(run('JSON.stringify(__r2)')), 'backup: an invalid setup must be skipped');
ok(!Number.isNaN(+run('examDate().getTime()')), 'backup: invalid setup must not reach examDate()');

// A malicious passage/question log row must not be restored
vm.runInContext(`globalThis.__r3 = applyBackup(${JSON.stringify({ log: [{ ts: 'x' }, { ts: 3000, sec: 'fig', diff: 'low', mode: 'timed', correct: 1, total: 20, secs: 100, answered: 20 }] })})`, ctx);
ok(run('store.get("log", []).length') === 3, 'backup: the valid row must merge');
ok(/"skipped":1/.test(run('JSON.stringify(__r3)')), 'backup: the broken row must be skipped');

console.log(`Smoke tests: ${failures === 0 ? 'all passed' : failures + ' failure(s)'}`);
process.exit(failures ? 1 : 0);
