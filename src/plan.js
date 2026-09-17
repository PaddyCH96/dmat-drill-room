/* ===== configurable exam setup + generated study plan ===== */
const pad2=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseYmd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const addDays=(s,n)=>{const d=parseYmd(s);d.setDate(d.getDate()+n);return ymd(d);};
const dayDiff=(a,b)=>Math.round((parseYmd(b)-parseYmd(a))/DAY);
const fmtDate=(s,o)=>parseYmd(s).toLocaleDateString(undefined,o||{day:'numeric',month:'short'});
function getSetup(){return store.get('setup',null);}
function examDate(){const s=getSetup();if(!s)return null;const [h,m]=(s.time||'09:00').split(':').map(Number);const d=parseYmd(s.exam);d.setHours(h,m,0,0);return d;}

const A={L:()=>({k:'link',url:'https://www.d-mat.de/en/preparation-for-the-exam/'}),N:()=>({k:'none'}),C:(sec,diff,mode,n=1)=>({k:'core',sec,diff,mode,n}),S:n=>({k:'subj',n}),B:()=>({k:'bank'}),K:g=>({k:'cards',g}),G:t=>({k:'tab',t}),W:n=>({k:'weak',n}),CB:()=>({k:'block'}),M:m=>({k:'mock',m})};
const DAY_TYPES={
 baseline:{t:'Baseline',items:[[0,'Read the official instructions for all four task types and watch the dMAT tutorial videos',[A.L()]],[60,'Work through the official example exercises without notes',[A.N()]],[150,'Diagnostic: one timed set per core section (Mixed difficulty)',[A.C('fig','mixed','timed'),A.C('eq','mixed','timed'),A.C('latin','mixed','timed')]],[300,'Subject: 2 practice tests, then review every mistake and note your weakest area',[A.S(2),A.B()]]]},
 latinEq:{t:'Latin Squares + Equations technique',items:[[0,'Tactics tab: the Latin Squares scanning order, then an untimed drill',[A.G('guide'),A.C('latin','adaptive','drill')]],[60,'Two timed Latin Squares sets',[A.C('latin','adaptive','timed',2)]],[135,'Equations: substitution patterns — a high-difficulty drill, then two timed sets',[A.C('eq','high','drill'),A.C('eq','adaptive','timed',2)]],[300,'Subject: 2 tests + review',[A.S(2),A.B()]]]},
 fig:{t:'Figure Sequences deep dive',items:[[0,'Trick cards: the Figure Sequences rules (movement, bounce, border walk, x + 1, rotation, colour)',[A.K('Figure Sequences')]],[30,'Drill Low → Medium → High, reading every explanation',[A.C('fig','low','drill'),A.C('fig','medium','drill'),A.C('fig','high','drill')]],[120,'Three timed Figure Sequences sets',[A.C('fig','adaptive','timed',3)]],[300,'Subject: 2 tests + review',[A.S(2),A.B()]]]},
 weakest:{t:'Weakest area first',items:[[0,'Attack your lowest-accuracy core section: three timed sets',[A.W(3)]],[120,'One timed set for each core section',[A.C('fig','adaptive','timed'),A.C('eq','adaptive','timed'),A.C('latin','adaptive','timed')]],[210,'Mental maths warm-up: fractions, squares, powers of 2 and 10',[A.N()]],[300,'Subject: 2 tests + review',[A.S(2),A.B()]]]},
 high:{t:'High difficulty',items:[[0,'A high-difficulty timed set for each core section',[A.C('fig','high','timed'),A.C('eq','high','timed'),A.C('latin','high','timed')]],[120,'Redo your mistakes and explain each rule out loud',[A.B()]],[210,'Speed: one Latin Squares set aiming for under 60 s per item',[A.C('latin','adaptive','timed')]],[300,'Subject: 2 tests + review',[A.S(2)]]]},
 block:{t:'Full core block',items:[[0,'Core block: 3 × 25 min back to back, no pauses',[A.CB()]],[90,'Redo your mistakes',[A.B()]],[150,'Second core block — practise pacing: flag, move on, guess before time runs out',[A.CB()]],[300,'Subject: 2 tests + review',[A.S(2),A.B()]]]},
 coremock:{t:'Core mock + subject',items:[[0,'Core-only mock (75 min) with fresh items',[A.M('core')]],[120,'Redo your mistakes',[A.B()]],[240,'Subject: 2 tests + review',[A.S(2)]]]},
 mock1:{t:'Mock exam 1',items:[[30,'Mock 1: core (75 min) → 30 min break → subject set 1',[A.M('mock1')]],[270,'Review every error and list the rules or formulas you forgot',[A.B()]],[330,'Light drill on your weakest section',[A.W(1)]]]},
 mock2:{t:'Mock exam 2',items:[[30,'Mock 2: core (75 min) → 30 min break → subject set 2',[A.M('mock2')]],[270,'Review and compare with Mock 1',[A.B()]],[330,'Re-read the official example solutions once more',[A.N()]]]},
 light:{t:'Light review',items:[[0,'One relaxed drill per core section',[A.C('fig','medium','drill'),A.C('eq','medium','drill'),A.C('latin','medium','drill')]],[90,'Review your due trick cards — no new material',[A.K('')]],[150,'Logistics: admission details, ID, route, arrival time, rules for the day',[A.N()]],[null,'Rest for the rest of the day and sleep early',[A.N()]]]},
};
const CANON=['baseline','latinEq','fig','weakest','high','block','coremock','mock1','mock2','light'];
function daySequence(n){
  if(n<=0)return [];
  if(n<9){const pri=['light','mock1','baseline','fig','latinEq','mock2','weakest','high'];const pick=pri.slice(0,n);return CANON.filter(t=>pick.includes(t));}
  const cyc=['weakest','high','block','weakest','high','coremock'];const mid=[];for(let i=0;i<n-6;i++)mid.push(cyc[i%cyc.length]);
  return ['baseline','latinEq','fig',...mid,'mock1','mock2','light'];
}
let PLAN=[], TASKS={};
function buildPlan(){
  PLAN=[];TASKS={};const s=getSetup();if(!s)return;
  const start=s.start||ymd(new Date()); const n=Math.min(60,dayDiff(start,s.exam)); const hours=Math.max(1,Math.min(10,+s.hours||6));
  const [fh,fm]=(s.from||'09:00').split(':').map(Number); const scale=hours/6;
  daySequence(n).forEach((type,i)=>{
    const d=addDays(start,i); const T=DAY_TYPES[type];
    const items=[],acts=[];
    T.items.forEach(([off,txt,a])=>{
      let label=txt;
      if(off!=null){let mins=fh*60+fm+Math.round(off*scale/15)*15;label=`${pad2(Math.floor(mins/60)%24)}:${pad2(mins%60)} ${txt}`;}
      if(type.startsWith('mock')&&off===30&&hours<4)label+=' (this takes about 3 h 15 min — plan a longer session today)';
      items.push(label); acts.push(a.map(x=>x.n>1&&hours<4?{...x,n:1}:x));
    });
    PLAN.push({d,t:T.t,type,items}); TASKS[d]=acts;
  });
}
function planSpan(){return PLAN.length?`${fmtDate(PLAN[0].d)} – ${fmtDate(PLAN[PLAN.length-1].d)}`:'';}
function mockDates(){const f=t=>{const p=PLAN.find(x=>x.type===t);return p?fmtDate(p.d):null;};return {mock1:f('mock1'),mock2:f('mock2')};}

function viewSetup(){
  const s=getSetup()||{}; const first=!getSetup(); const today=ymd(new Date());
  const def={exam:s.exam||addDays(today,10),time:s.time||'09:00',start:s.start||today,hours:s.hours||6,from:s.from||'09:00'};
  return `<div class="stack">
  <div class="panel stack">
    ${first?`<div><p class="eyebrow">Welcome</p><h2>Set up your dMAT prep</h2><p class="muted" style="max-width:62ch;margin-top:6px">Tell the Drill Room when your exam is and how much time you have each day. It builds a day-by-day plan from today to your test. You can change this any time in Settings.</p></div>`:`<div><p class="eyebrow">Settings</p><h2>Your exam and study plan</h2></div>`}
    <form id="setupform" class="setup">
      <label>Exam date<input type="date" id="su-exam" required value="${def.exam}" min="${today}"></label>
      <label>Exam start time<input type="time" id="su-time" required value="${def.time}"></label>
      <label>Start the plan on<input type="date" id="su-start" required value="${def.start}"></label>
      <label>Study hours per day<select id="su-hours">${[1,2,3,4,5,6,7,8].map(h=>`<option value="${h}" ${+def.hours===h?'selected':''}>${h} ${h===1?'hour':'hours'}</option>`).join('')}</select></label>
      <label>Daily study starts at<input type="time" id="su-from" required value="${def.from}"></label>
      <p id="su-preview" class="muted" style="grid-column:1/-1"></p>
      <p id="su-err" class="tag bad" hidden style="grid-column:1/-1;justify-self:start"></p>
      <div class="row" style="grid-column:1/-1"><button class="btn primary big" type="submit">${first?'Build my plan':'Save changes'}</button>${first?'':'<span class="muted" style="font-size:14.5px">Your scores, mistakes and cards are kept.</span>'}</div>
    </form>
  </div>
  ${first?'':`<div class="panel stack"><h3>Your data</h3><p class="muted">${Sync.ref?'Progress syncs to your Claude account.':'Progress is stored in this browser only. Copy the backup code to move it to another browser or device.'}</p>
  <div class="row"><button class="btn" data-act="export">Copy backup code</button><button class="btn ghost" data-act="import">Import code</button><button class="btn ghost" data-act="reset" style="color:var(--bad)">Reset all progress</button></div>
  <label for="codebox" class="muted" hidden>Backup code</label><textarea id="codebox" hidden rows="3" style="width:100%;font-family:var(--mono);font-size:12px;background:var(--sunk);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px"></textarea><p id="codemsg" class="muted"></p></div>`}
  <p class="muted" style="font-size:13.5px">dMAT Drill Room is an unofficial, open-source practice tool and is not affiliated with g.a.s.t. or the TestDaF-Institut. Always check the official rules at <a href="https://www.d-mat.de/en/" target="_blank" rel="noopener">d-mat.de</a>.</p>
  </div>`;
}
function setupPreview(){
  const f=id=>document.getElementById(id); if(!f('su-exam'))return;
  const exam=f('su-exam').value,start=f('su-start').value; const err=f('su-err'),pv=f('su-preview');
  if(!exam||!start){pv.textContent='';return;}
  const n=dayDiff(start,exam);
  if(n<1){err.hidden=false;err.textContent='The plan must start at least one day before the exam.';pv.textContent='';return;}
  err.hidden=true; const seq=daySequence(Math.min(60,n));
  pv.innerHTML=`<b>${Math.min(60,n)}-day plan</b>${n>60?' (capped at 60 days; the plan will start later)':''}: ${seq.map(t=>DAY_TYPES[t].t).filter((v,i,a)=>a.indexOf(v)===i).join(' → ')}.`;
}
function saveSetup(e){
  e.preventDefault(); const f=id=>document.getElementById(id);
  let start=f('su-start').value; const exam=f('su-exam').value;
  if(dayDiff(start,exam)<1){setupPreview();return;}
  if(dayDiff(start,exam)>60)start=addDays(exam,-60);
  store.set('setup',{exam,time:f('su-time').value||'09:00',start,hours:+f('su-hours').value,from:f('su-from').value||'09:00'});
  buildPlan(); countdown(); setTab('today');
}
