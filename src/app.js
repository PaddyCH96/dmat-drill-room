/* ===== app ===== */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DAY=86400000;
const SYNC_KEYS=['log','qlog','cards','plandone','seenP','mistakes','level','todaydone','skin','setup'];
const MEM={};
const store={
  get(k,d){ if(k in MEM)return MEM[k]; try{const v=localStorage.getItem('dmat_'+k);if(v){MEM[k]=JSON.parse(v);return MEM[k];}}catch(e){} return d; },
  set(k,v,quiet){ MEM[k]=v; try{localStorage.setItem('dmat_'+k,JSON.stringify(v))}catch(e){} if(!quiet&&SYNC_KEYS.includes(k))Sync.queue(); }
};
/* ---- account sync (db + user capabilities); falls back to this browser ---- */
function mergeVal(k,l,r){
  if(l==null)return r; if(r==null)return l;
  if(Array.isArray(l)&&Array.isArray(r)){const key=x=>[x.ts,x.sec,x.pid,x.qi].join('|');const m=new Map();r.forEach(x=>m.set(key(x),x));l.forEach(x=>m.set(key(x),x));return [...m.values()].sort((a,b)=>a.ts-b.ts);}
  if(typeof l==='object'&&typeof r==='object'){const o={...r};for(const [kk,lv] of Object.entries(l)){const rv=r[kk];if(rv&&lv&&typeof rv==='object'&&typeof lv==='object'&&(rv.u||0)>(lv.u||0))o[kk]=rv;else o[kk]=lv;}return o;}
  return l;
}
const Sync={ref:null,status:'local',timer:null,busy:false,again:false,
  async init(){
    try{
      if(!window.claude||!window.claude.use)return;
      const [db,user]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
      if(!db||!user)return;
      const uid=await user.id(); if(!uid)return;
      this.ref=db.doc('data/users/'+uid+'/state');
      const snap=await this.ref.get();
      if(snap.exists){const rs=(snap.data()||{}).s||{};SYNC_KEYS.forEach(k=>{if(rs[k]!=null)store.set(k,mergeVal(k,store.get(k,null),rs[k]),true);});}
      this.status='synced'; applySkin(store.get('skin','auto')); await this.push(); if(!session)render(); syncBadge();
    }catch(e){ this.ref=null; this.status='local'; syncBadge(); }
  },
  queue(){ if(!this.ref)return; this.status='saving'; syncBadge(); clearTimeout(this.timer); this.timer=setTimeout(()=>this.push(),2500); },
  pack(){
    const s={}; SYNC_KEYS.forEach(k=>{const v=store.get(k,null); if(v!=null)s[k]=v;});
    if(s.log)s.log=s.log.slice(-500);
    const now=Date.now();
    if(s.mistakes){const e=Object.entries(s.mistakes).filter(([k,m])=>!(m.removed&&now-m.u>14*DAY));s.mistakes=Object.fromEntries(e);}
    let lim=1000; if(s.qlog)s.qlog=s.qlog.slice(-lim);
    while(JSON.stringify(s).length>230000&&s.qlog&&s.qlog.length>50){lim=Math.floor(lim*0.7);s.qlog=s.qlog.slice(-lim);}
    return s;
  },
  async push(){
    if(!this.ref)return; if(this.busy){this.again=true;return;} this.busy=true;
    try{ await this.ref.set({s:this.pack(),updated:Date.now()}); this.status='synced'; }
    catch(e){ if(e&&(e.code==='invalid_argument'||e.code==='revoked'||e.code==='not_granted')){this.ref=null;this.status='local';} else {this.status='retry'; setTimeout(()=>this.queue(),8000);} }
    this.busy=false; syncBadge(); if(this.again){this.again=false; this.push();}
  }
};
function syncBadge(){const el=document.getElementById('syncstate');if(!el)return;el.textContent={synced:'✓ Progress synced to your account',saving:'Saving…',retry:'Sync paused — retrying',local:'Progress saved in this browser'}[Sync.status]||'';}
/* ---- Claude explanations (sample capability) ---- */
const AI={fn:null,async init(){try{if(window.claude&&window.claude.use){this.fn=await window.claude.use('sample');if(this.fn&&!session)render();}}catch(e){this.fn=null;}}};
const SECTIONS={fig:{name:'Figure Sequences',n:20,min:25,gen:genFigures,target:75},eq:{name:'Mathematical Equations',n:20,min:25,gen:genEquations,target:75},latin:{name:'Latin Squares',n:20,min:25,gen:genLatin,target:75},subj:{name:'Subject Module',min:90,target:120},mix:{name:'Mistake bank',target:90},bank:{name:'Mistake bank'}};
const PBY=Object.fromEntries(PASSAGES.map(p=>[p.id,p]));

let tab='today', session=null, timerId=null;
function applySkin(k){ if(k&&k!=='auto')document.documentElement.setAttribute('data-skin',k); else document.documentElement.removeAttribute('data-skin');
  document.querySelectorAll('.skin').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.skin)===(k||'auto'))));}
applySkin(store.get('skin','auto'));
document.querySelector('.skins').addEventListener('click',e=>{const b=e.target.closest('.skin');if(!b)return;store.set('skin',b.dataset.skin);applySkin(b.dataset.skin);});
let leaveArmed=null;
function setTab(t){ if(session&&!session.finished&&leaveArmed!==t){ leaveArmed=t; const b=document.querySelector(`#tabs button[data-tab="${t}"]`); if(b){b.dataset.label=b.dataset.label||b.textContent; b.textContent='Tap again to leave session';} setTimeout(()=>{leaveArmed=null;document.querySelectorAll('#tabs button').forEach(x=>{if(x.dataset.label)x.textContent=x.dataset.label;});},3000); return; }
  leaveArmed=null; document.querySelectorAll('#tabs button').forEach(x=>{if(x.dataset.label)x.textContent=x.dataset.label;}); stopTimer(); session=null; tab=t; document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t)); render(); }
document.getElementById('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTab(b.dataset.tab)});
function countdown(){const E=examDate();const el=$('#countdown');if(!E){el.textContent='No exam date set yet';return;}const ms=E-new Date();const d=Math.ceil(dayDiff(ymd(new Date()),getSetup().exam));el.innerHTML=ms>0?(d<=0?'Exam <b>today</b> · good luck':`Exam on ${fmtDate(getSetup().exam)} · <b>${d} day${d===1?'':'s'}</b> to go`):'Exam finished';}
countdown();setInterval(countdown,60000);

function render(){ window.__aiItems=[]; const v=$('#view'); if(session) return renderSession();
  if(!getSetup()&&tab!=='setup')tab='setup'; document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab)); document.getElementById('tabs').hidden=!getSetup();
  v.innerHTML=({setup:viewSetup,today:viewToday,plan:viewPlan,practice:viewPractice,mock:viewMock,progress:viewProgress,guide:viewGuide,tricks:viewTricks})[tab]();
  bindView(); }

/* ---------- PLAN ---------- */
function viewPlan(){
  const done=store.get('plandone',{}); const today=ymd(new Date()); const S=getSetup();
  const log=store.get('log',[]);
  return `<div class="stack"><div class="panel"><div class="row" style="justify-content:space-between"><div><p class="eyebrow">${planSpan()} · ${S.hours} h per day from ${S.from}</p><h2>Your ${PLAN.length}-day plan</h2></div><span class="tag">${Object.values(done).filter(Boolean).length} / ${PLAN.length} days done</span></div>
  <p class="muted" style="margin-top:6px;max-width:64ch">Tick a day off when it's done. Take a 10-minute break every hour. Change dates or hours in <button class="linkbtn" data-go="setup">Settings</button>.</p>
  <div style="margin-top:12px">${PLAN.map((p,i)=>{const dt=parseYmd(p.d);const isT=p.d===today;return `<div class="day ${isT?'today':''} ${done[p.d]?'done':''}"><div class="date">${dt.toLocaleDateString(undefined,{weekday:'short'})}<b>${fmtDate(p.d)}</b>Day ${i+1}</div><div><h3>${p.t}${isT?' <span class="tag good">today</span>':''}</h3><ul>${p.items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><label class="check"><input type="checkbox" id="pd-${p.d}" data-plan="${p.d}" ${done[p.d]?'checked':''}> Done</label></div>`}).join('')}
  <div class="day"><div class="date">${parseYmd(S.exam).toLocaleDateString(undefined,{weekday:'short'})}<b>${fmtDate(S.exam)}</b>Exam</div><div><h3>dMAT exam (from ${S.time})</h3><ul><li>Light breakfast, one 10-minute warm-up set in the morning, then stop</li><li>Core Module 90 min → 30 min break → Subject Module 90 min</li></ul></div><span></span></div></div></div>
  <div class="panel"><div class="row" style="justify-content:space-between"><h3>Ready to start?</h3><span class="muted">${log.length} sessions logged</span></div>
  <div class="row" style="margin-top:12px"><button class="btn primary" data-go="practice">Open practice</button><button class="btn" data-go="mock">Mock exam</button><button class="btn ghost" data-go="progress">See progress</button></div></div></div>`;
}

/* ---------- PRACTICE ---------- */
let pr=store.get('prsel',{sec:'latin',diff:'mixed',mode:'timed',pid:null});
function viewPractice(){
  const seen=store.get('seenP',{});
  const secCard=(k,desc)=>`<button class="pick" data-sec="${k}" aria-pressed="${pr.sec===k}"><h3>${SECTIONS[k].name}</h3><span class="muted">${desc}</span><span class="meta">${k==='subj'?'text + 6 questions':k==='bank'?'right twice → removed':'20 items · 25 min'}</span></button>`;
  let opts=''; const ex=examDay();
  const exRow=`<div class="row"><span class="label">Exam-day mode</span><button class="switch" data-examday="1" role="switch" aria-checked="${ex}"><i></i></button><span class="muted" style="font-size:14.5px">${ex?'On: no hints, tricks, labels or feedback until the end.':'Off: hints, labels and Learn/Drill feedback are available.'}</span></div>`;
  if(pr.sec==='bank'){
    const {due,all}=bankCounts();
    opts=`<h3>Mistake bank</h3><p class="muted" style="max-width:62ch">Every question you answer wrong lands here. Retry it a day later; it leaves the bank after you get it right twice in a row. You see the answer and trick after each question.</p>
    <div class="row"><span class="label">Questions</span><div class="seg"><button data-bankset="due" aria-pressed="${pr.bankset!=='all'}">Due now (${due})</button><button data-bankset="all" aria-pressed="${pr.bankset==='all'}">Everything in the bank (${all})</button></div></div>`;
  } else if(pr.sec!=='subj'){
    const lv=store.get('level',{})[pr.sec]||2;
    opts=`<div class="row"><span class="label">Difficulty</span><div class="seg">${['adaptive','mixed','low','medium','high'].map(d=>`<button data-diff="${d}" aria-pressed="${pr.diff===d}">${d==='adaptive'?`Adaptive · level ${lv} of 3`:d[0].toUpperCase()+d.slice(1)}</button>`).join('')}</div></div>
    ${pr.diff==='adaptive'?`<p class="muted" style="font-size:14.5px;margin-top:-8px">Adaptive moves you up a level after a session at 85% or better and down after one below 60%.</p>`:''}
    <div class="row"><span class="label">Mode</span><div class="seg"><button data-mode="timed" aria-pressed="${pr.mode==='timed'||ex}">Timed · 20 in 25 min</button><button data-mode="drill" aria-pressed="${pr.mode==='drill'&&!ex}" ${ex?'disabled':''}>Drill · 8 items, feedback after each</button></div></div>${exRow}`;
  } else {
    pr.area=pr.area||'math'; pr.smode=pr.smode||'exam'; pr.skind=pr.skind||'test';
    const tests=areaTests(pr.area); const mocks=PASSAGES.filter(p=>p.area===pr.area&&MOCK_OF[p.id]);
    const testCard=(p,label,extra='')=>{const s=seen[p.id];const types=[...new Set(p.qs.map(q=>q.t))];return `<button class="pick" data-pid="${p.id}" aria-pressed="${pr.skind==='test'&&pr.pid===p.id}"><span class="eyebrow">${label}${extra}</span><h3>${esc(p.title)}</h3><span class="meta">${types.map(t=>QTYPES[t]).join(' · ')}</span><span class="meta" style="margin-top:6px">${s?`<span class="tag ${s.c/s.t>=.8?'good':s.c/s.t>=.5?'warn':'bad'}">Last score ${s.c}/${s.t}</span>`:'Not attempted yet'}</span></button>`};
    opts=`<div class="row"><span class="label">Subject</span><div class="seg">${Object.entries(AREAS).map(([k,v])=>`<button data-area="${k}" aria-pressed="${pr.area===k}">${v}</button>`).join('')}</div></div>
    <div class="row"><span class="label">Mode</span><div class="seg"><button data-smode="exam" aria-pressed="${pr.smode==='exam'||ex}">Exam · review at the end</button><button data-smode="learn" aria-pressed="${pr.smode==='learn'&&!ex}" ${ex?'disabled':''}>Learn · answer + trick after each</button></div></div>${exRow}
    <h3>${AREAS[pr.area]} · ${tests.length} tests</h3>
    <div class="grid2">${tests.map((p,i)=>testCard(p,`Test ${i+1}`)).join('')}
    ${tests.length>1?`<button class="pick" data-marathon="1" aria-pressed="${pr.skind==='marathon'}"><span class="eyebrow">All ${tests.length} tests</span><h3>${AREAS[pr.area]} marathon</h3><span class="muted">Every test in this subject back to back, ${tests.length*13} min countdown.</span><span class="meta">${tests.reduce((s,p)=>s+p.qs.length,0)} questions</span></button>`:''}</div>
    ${mocks.length?`<p class="muted" style="font-size:15px">Saved for the mock exams (you can still open them):</p><div class="grid2">${mocks.map(p=>testCard(p,'Mock text',` · ${MOCK_OF[p.id]==='mock1'?'Mock 1':'Mock 2'}`)).join('')}</div>`:''}
    <div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:14px" ${ex?'hidden':''}><h3>Or drill one question type</h3><p class="muted" style="font-size:15px">8 questions from all subjects, with the answer and trick after each.</p><div class="seg">${Object.entries(QTYPES).map(([k,v])=>`<button data-qtype="${k}" aria-pressed="${pr.skind==='type'&&pr.qtype===k}">${v}</button>`).join('')}</div></div>
    `;
  }
  const bc=bankCounts();
  const can=pr.sec==='bank'?(pr.bankset==='all'?bc.all:bc.due)>0:(pr.sec!=='subj'||(pr.skind==='test'&&pr.pid)||pr.skind==='marathon'||(pr.skind==='type'&&pr.qtype&&!ex));
  return `<div class="stack"><div class="step"><i>1</i>Choose a section</div><div class="grid2">${secCard('fig','Spot the movement, rotation and colour rules; pick images 5 and 6.')}${secCard('eq','Solve systems of equations in your head (values 1–20).')}${secCard('latin','5×5 grid: find the letter for the ? cell.')}${secCard('subj','Read an academic text, answer multiple-choice questions.')}${secCard('bank',`Redo the questions you got wrong. ${bc.due} due now, ${bc.all} in the bank.`)}</div>
  <div class="step" style="margin-top:8px"><i>2</i>Set up your session</div><div class="panel stack">${opts}<div class="row" style="border-top:1px solid var(--line);padding-top:18px"><button class="btn primary big" id="startP" ${can?'':'disabled'}>Start session</button><span class="noteban">${can?'Exam rule: no notes. Solve everything in your head.':pr.sec==='bank'?'Nothing to redo yet. Wrong answers from any session land here.':'Pick a test above to continue.'}</span></div></div></div>`;
}
function mixedDiffs(n){const a=[];for(let i=0;i<n;i++)a.push(i<n*0.3?'low':i<n*0.65?'medium':'high');return a;}
function adaptiveDiffs(n,lv){const w={1:[.5,.4,.1],2:[.3,.35,.35],3:[.1,.3,.6]}[lv]||[.3,.35,.35];const a=[];for(let i=0;i<n;i++){const f=(i+.5)/n;a.push(f<w[0]?'low':f<w[0]+w[1]?'medium':'high');}return a;}
function buildCore(sec,diff,n){const ds=diff==='mixed'?mixedDiffs(n):diff==='adaptive'?adaptiveDiffs(n,store.get('level',{})[sec]||2):Array(n).fill(diff);return ds.map(d=>({...SECTIONS[sec].gen(d),uid:Math.random().toString(36).slice(2,10)}));}
function examDay(){return !!store.get('examday',false);}
function subjItem(id,qi){const q=PBY[id].qs[qi];const order=RNG.shuffle([0,1,2,3]);return {type:'subj',pid:id,q:q.q,o:order.map(i=>q.o[i]),a:order.indexOf(q.a),e:q.e,qi,t:q.t,tip:q.tip,area:PBY[id].area};}
function buildSubject(ids){const items=[];ids.forEach(id=>PBY[id].qs.forEach((q,qi)=>items.push(subjItem(id,qi))));return items;}
function startPractice(task){
  store.set('prsel',pr); const ex=examDay();
  if(pr.sec==='bank'){startBank(pr.bankset==='all',task);return;}
  if(pr.sec==='subj'){ const learn=pr.smode==='learn'&&!ex;
    if(pr.skind==='type'){const pool=[];PASSAGES.filter(p=>!MOCK_OF[p.id]).forEach(p=>p.qs.forEach((q,qi)=>{if(q.t===pr.qtype)pool.push([p.id,qi]);}));const pick=RNG.shuffle(pool).slice(0,8);newSession({kind:'practice',drill:true,parts:[{sec:'subj',items:pick.map(([id,qi])=>subjItem(id,qi)),limit:null,target:pick.length*120}]});return;}
    if(pr.skind==='marathon'){const ids=areaTests(pr.area).map(p=>p.id);newSession({kind:'practice',drill:learn,task,parts:[{sec:'subj',items:buildSubject(ids),limit:learn?null:ids.length*13*60,target:ids.length*13*60,pids:ids}]});return;}
    newSession({kind:'practice',drill:learn,task,parts:[{sec:'subj',items:buildSubject([pr.pid]),limit:ex?13*60:null,target:13*60,pids:[pr.pid]}]}); }
  else { const timed=pr.mode==='timed'||ex; const n=timed?20:8; newSession({kind:'practice',drill:!timed,diff:pr.diff,task,parts:[{sec:pr.sec,items:buildCore(pr.sec,pr.diff,n),limit:timed?25*60:null}]}); }
}

/* ---------- MOCK ---------- */
function viewMock(){
  const log=store.get('log',[]); const didM=k=>log.some(l=>l.mock===k);
  const card=(k,title)=>`<div class="pick"><span class="eyebrow">${didM(k)?'completed':'not taken yet'}</span><h3>${title}</h3><span class="muted">Figure Sequences 25′ → Equations 25′ → Latin Squares 25′ → 30′ break → Subject set (${MOCK_SETS[k].map(id=>PBY[id].domain).join(', ')})</span><span class="meta">≈ 3 h 15 min in total</span><button class="btn primary" data-mock="${k}" style="margin-top:6px;align-self:flex-start">Start ${title}</button></div>`;
  return `<div class="stack"><div class="panel stack"><div><p class="eyebrow">Full exam simulation</p><h2>Sit it like the real thing</h2></div>
  <p class="tag warn" style="align-self:flex-start">Mocks always run in exam-day mode: no hints or feedback until the end.</p>
  <p class="muted" style="max-width:68ch">Each core section is 20 fresh items at mixed difficulty with a hard 25-minute cut-off. The subject set has 4 unseen texts (24 questions) in 60 minutes. The real module is 90 minutes and may contain more texts, so treat 60 minutes for 24 questions as the pace to hold. Phone away, no paper, one sitting.</p>
  <div class="grid2">${card('mock1','Mock 1')}${card('mock2','Mock 2')}</div>
  <p class="muted">${(()=>{const m=mockDates();return m.mock1?`Your plan schedules Mock 1 on ${m.mock1}${m.mock2?` and Mock 2 on ${m.mock2}`:''}. `:''})()}Want an extra core-only mock? Start one below; it generates new items every time.</p>
  <div><button class="btn" data-mock="core">Core-only mock (75 min)</button></div></div></div>`;
}
function startMock(k,task){
  const parts=['fig','eq','latin'].map(s=>({sec:s,items:buildCore(s,'mixed',20),limit:25*60}));
  if(k!=='core'){parts.push({sec:'break',limit:30*60,items:[]});parts.push({sec:'subj',items:buildSubject(MOCK_SETS[k]),limit:60*60,pids:MOCK_SETS[k]});}
  newSession({kind:'mock',mock:k,task,exam:true,parts});
}

/* ---------- SESSION ---------- */
function newSession(s){ session={...s,pi:0,finished:false,results:[]}; if((examDay()&&s.kind!=='bank')||s.kind==='mock'){session.exam=true;session.drill=false;} startPart(); }
function startPart(){ const p=session.parts[session.pi]; p.idx=0; p.ans=p.items.map(()=>null); p.flags=new Set(); p.checked=new Set(); p.t0=Date.now(); p.itemT=p.items.map(()=>0); p.lastSwitch=Date.now();
  stopTimer(); timerId=setInterval(tick,500); render(); window.scrollTo({top:0}); }
function stopTimer(){ if(timerId)clearInterval(timerId); timerId=null; }
function elapsed(p){return Math.floor((Date.now()-p.t0)/1000);}
const fmt=s=>`${Math.floor(s/60)}:${String(Math.max(0,s)%60).padStart(2,'0')}`;
function tick(){ const p=session.parts[session.pi]; const el=$('#timer'); if(!el)return; const e=elapsed(p);
  if(p.limit){const left=p.limit-e; el.textContent=fmt(Math.max(0,left)); el.className='timer'+(left<=60?' crit':left<=300?' warn':''); paceHint(p,e); if(left<=0){ finishPart(true);} }
  else { el.textContent=fmt(e); if(p.target&&e>p.target)el.className='timer warn'; } }
function paceHint(p,e){const el=$('#pace');if(!el)return;if(session.exam||!p.items.length){el.textContent='';return;}
  const per=p.limit/p.items.length; const expected=Math.min(p.items.length,Math.floor(e/per)); const done=p.items.filter((x,i)=>isAnswered(x,p.ans[i])).length; const d=expected-done;
  el.textContent=d>=2?`${d} behind pace`:d<=-2?`${-d} ahead of pace`:'On pace'; el.className='pace '+(d>=3?'bad':d>=2?'warn':'good');}
function switchItem(i){ const p=session.parts[session.pi]; p.itemT[p.idx]+=(Date.now()-p.lastSwitch)/1000; p.lastSwitch=Date.now(); p.idx=Math.max(0,Math.min(p.items.length-1,i)); renderSession(); }
function renderSession(){
  window.__aiItems=[]; const v=$('#view'); const p=session.parts[session.pi];
  if(session.finished) { v.innerHTML=renderResults(); bindView(); return; }
  const secName=p.sec==='break'?'Break':SECTIONS[p.sec].name; const EX=!!session.exam;
  const stepInfo=session.parts.length>1?`Part ${session.pi+1} of ${session.parts.length} · `:'';
  if(p.sec==='break'){ v.innerHTML=`<div class="panel stack" style="align-items:flex-start"><p class="eyebrow">${stepInfo}Break</p><h2>30-minute break</h2><p class="muted">Stand up, drink water, look away from the screen. The Subject Module starts when the timer ends, or when you are ready.</p><div class="timer" id="timer">30:00</div><button class="btn primary" data-act="endbreak">Start Subject Module now</button></div>`; bindView(); tick(); return; }
  const it=p.items[p.idx]; const answered=i=>isAnswered(p.items[i],p.ans[i]);
  const drill=session.drill; const checked=p.checked.has(p.idx);
  const strip=p.items.map((x,i)=>{let c='';if(drill&&p.checked.has(i))c=isCorrect(x,p.ans[i])?'ok':'no';else if(answered(i))c='done';return `<button class="${c} ${i===p.idx?'cur':''} ${p.flags.has(i)?'flag':''}" data-jump="${i}" aria-label="Item ${i+1}">${i+1}</button>`}).join('');
  let body='';
  if(it.type==='latin')body=renderLatin(it,p.ans[p.idx],checked);
  if(it.type==='eq')body=renderEq(it,p.ans[p.idx],checked);
  if(it.type==='fig')body=renderFig(it,p.ans[p.idx],checked);
  if(it.type==='subj')body=renderSubj(it,p.ans[p.idx],checked,p);
  const last=p.idx===p.items.length-1;
  const nav=`<div class="row" style="margin-top:18px">
    <button class="btn" data-act="prev" ${p.idx===0?'disabled':''}>Previous</button>
    ${drill&&!checked?`<button class="btn primary" data-act="check" ${answered(p.idx)?'':'disabled'}>Check answer</button>`:''}
    ${!last?`<button class="btn ${drill&&!checked?'':'primary'}" data-act="next">Next</button>`:''}
    <button class="btn ghost" data-act="flag">${p.flags.has(p.idx)?'Unflag':'Flag for review'}</button>
    <span style="flex:1"></span>
    <button class="btn ${last?'primary':''}" data-act="finish">${session.pi<session.parts.length-1?'Submit section':'Finish &amp; see results'}</button></div>`;
  v.innerHTML=`<div class="panel"><div class="sessbar"><div><p class="eyebrow">${stepInfo}${session.kind==='mock'?'Mock exam':session.kind==='bank'?'Redo mistakes':drill?'Drill':'Timed practice'}${EX&&session.kind!=='mock'?' · exam-day mode':''}</p><h3 style="font-size:20px">${secName}</h3></div><div class="row"><span id="pace" class="pace"></span><span class="muted" style="font-size:14.5px">${Object.keys(p.ans).filter(i=>answered(+i)).length}/${p.items.length} answered</span><div class="timer" id="timer">--:--</div></div></div>
  <div class="navstrip">${strip}</div>
  <div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="eyebrow">Item ${p.idx+1}${it.diff&&!EX?` · ${it.diff}`:''}${session.kind==='bank'?` · ${bankLabel(it)}`:''}</span><span class="noteban">${EX?'No notes — work it in your head':keyHint(it,drill&&!checked)}</span></div>
  ${body}${nav}</div>`;
  bindView(); tick();
}
function isAnswered(it,a){ if(a==null)return false; if(it.type==='eq')return a.every(x=>x!==''&&x!=null); if(it.type==='fig')return a[0]!=null&&a[1]!=null; return true; }
function isCorrect(it,a){ if(!isAnswered(it,a))return false;
  if(it.type==='latin')return a===it.answer; if(it.type==='eq')return a.every((x,i)=>+x===it.answer[i]);
  if(it.type==='fig')return a[0]===it.answers[0].correct&&a[1]===it.answers[1].correct; if(it.type==='subj')return a===it.a; }

/* renderers */
const COLS=['α','β','γ','δ','ε'];
function latinTable(it,fillSteps){ const g=it.grid.map(r=>r.slice()); const filled=new Set(); if(fillSteps){it.steps.forEach(s=>{g[s.r][s.c]=s.v;filled.add(s.r*5+s.c)});}
  return `<div class="scroll-x"><table class="ls"><tr><th></th>${COLS.map(c=>`<th>${c}</th>`).join('')}</tr>${g.map((r,ri)=>`<tr><th>${ri+1}</th>${r.map((x,ci)=>{const q=ri===it.tr&&ci===it.tc;return `<td class="${q?'q':''} ${filled.has(ri*5+ci)&&!q?'fill':''}">${q&&!fillSteps?'?':(x||'')}</td>`}).join('')}</tr>`).join('')}</table></div>`; }
function renderLatin(it,a,checked){
  return `<div class="stack">${latinTable(it,false)}<div class="opts">${LETTERS.map(L=>{let c='';if(checked){if(L===it.answer)c='right';else if(L===a)c='wrong';}return `<button class="opt ${c}" data-latin="${L}" aria-pressed="${a===L}" ${checked?'disabled':''}>${L}</button>`}).join('')}</div>${checked?explainLatin(it):''}</div>`; }
function explainLatin(it){ return `<div class="explain"><b>Answer: ${it.answer}.</b> Solution path:<ol>${it.steps.map(s=>`<li>${esc(s.why)}</li>`).join('')}</ol>${latinTable(it,true)}${aiBtn(it)}</div>`; }
function renderEq(it,a,checked){ a=a||it.names.map(()=>'');
  return `<div class="stack"><div class="eqs">${it.eqs.map(e=>`<div>${esc(e)}</div>`).join('')}</div><p class="muted">Each letter is a whole number from 1 to 20.</p>
  <div class="ansrow">${it.names.map((n,i)=>{let c='';if(checked)c=+a[i]===it.answer[i]?'right':'wrong';return `<label for="eq-${i}">${n} =<input id="eq-${i}" inputmode="numeric" data-eq="${i}" value="${esc(a[i]??'')}" ${checked?'disabled':''} autocomplete="off"></label>`}).join('')}</div>${checked?explainEq(it):''}</div>`; }
function explainEq(it){ return `<div class="explain"><b>Answer: ${it.names.map((n,i)=>`${n} = ${it.answer[i]}`).join(', ')}.</b><br>Start with the equation that has the fewest unknowns (or that expresses one letter directly, like "3 × A = C"), substitute it into the others, and finish by checking every equation with your values.${aiBtn(it)}</div>`; }
const SHAPE_SVG={
 tri:'<polygon points="0,-11 11,9 -11,9"/>', hex:'<polygon points="-10,0 -5,-9 5,-9 10,0 5,9 -5,9"/>', sq:'<rect x="-9" y="-9" width="18" height="18"/>',
 half:'<path d="M-11,4 A11,11 0 0 1 11,4 Z"/>', ell:'<path d="M-10,-10 H-3 V3 H10 V10 H-10 Z"/>', trap:'<polygon points="-10,-9 3,-9 11,0 3,9 -10,9"/>',
 arrow:'<path d="M-11,-3 H2 V-9 L11,0 L2,9 V3 H-11 Z"/>', circ:'<circle r="9"/>'};
function frameSVG(fr){ const s=28; let g=''; for(let i=0;i<=4;i++){g+=`<line x1="${2+i*s}" y1="2" x2="${2+i*s}" y2="${2+4*s}"/><line x1="2" y1="${2+i*s}" x2="${2+4*s}" y2="${2+i*s}"/>`;}
  const shapes=fr.map(o=>`<g transform="translate(${2+o.c*s+s/2},${2+o.r*s+s/2}) rotate(${o.rot})" fill="${COLORS[o.color]}" stroke="#1d1d1f" stroke-width="1.2" stroke-linejoin="round">${SHAPE_SVG[o.shape]}</g>`).join('');
  return `<svg viewBox="0 0 116 116" role="img" aria-label="matrix"><rect x="2" y="2" width="112" height="112" fill="var(--cell)"/><g stroke="#8A94A3" stroke-width="1">${g}</g>${shapes}</svg>`; }
function renderFig(it,a,checked){ a=a||[null,null];
  const cols=it.answers.map((ans,k)=>`<div class="figcol"><div class="qslot">?</div><span class="eyebrow">Image ${k+1}</span>${ans.options.map((o,j)=>{let c='';if(checked){if(j===ans.correct)c='right';else if(j===a[k])c='wrong';}return `<button class="figopt ${c}" data-fig="${k}:${j}" aria-pressed="${a[k]===j}" aria-label="Image ${k+1}, option ${j+1}" ${checked?'disabled':''}>${frameSVG(o)}</button>`}).join('')}</div>`).join('');
  return `<div class="stack"><div class="scroll-x"><div class="figrow">${it.frames.map((f,i)=>`<div class="frame">${frameSVG(f)}<span class="eyebrow">${i+1}</span></div>`).join('')}</div></div>
  <p class="muted">Choose the matrix that comes next (image 1) and the one after it (image 2).</p><div class="figcols">${cols}</div>${checked?explainFig(it):''}</div>`; }
function explainFig(it){ return `<div class="explain"><b>Rules in this sequence:</b><ul>${it.explain.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="figrow" style="margin-top:8px">${it.answers.map((a,k)=>`<div class="frame">${frameSVG(a.options[a.correct])}<span class="eyebrow">correct ${k+1}</span></div>`).join('')}</div>${aiBtn(it)}</div>`; }
function renderSubj(it,a,checked,p){ const P=PBY[it.pid]; const pos=p.items.filter(x=>x.pid===it.pid); const k=pos.indexOf(it)+1;
  return `<div class="subj"><div class="passage"><p class="eyebrow">${esc(P.domain)}</p><h3>${esc(P.title)}</h3>${P.text}</div>
  <div class="stack"><p class="eyebrow">Question ${k} of ${pos.length} on this text${session&&session.exam?'':' · '+(QTYPES[it.t]||'')}</p><p class="qtext">${it.q}</p><div class="mcq">${it.o.map((o,j)=>{let c='';if(checked){if(j===it.a)c='right';else if(j===a)c='wrong';}return `<button class="${c}" data-mcq="${j}" aria-pressed="${a===j}" ${checked?'disabled':''}><span class="l">${'abcd'[j]})</span><span>${o}</span></button>`}).join('')}</div>${checked?subjExplain(it):''}</div></div>`; }
function subjExplain(it){return `<div class="explain">${it.e}${tipOf(it)?`<p class="trick"><b>Trick:</b> ${tipOf(it)}</p>`:''}${aiBtn(it)}</div>`;}

function finishPart(auto){
  const p=session.parts[session.pi]; if(p.sec!=='break'){
    p.itemT[p.idx]+=(Date.now()-p.lastSwitch)/1000;
    const correct=p.items.filter((x,i)=>isCorrect(x,p.ans[i])).length; const secs=Math.min(elapsed(p),p.limit||1e9);
    const r={sec:p.sec,correct,total:p.items.length,secs,answered:p.items.filter((x,i)=>isAnswered(x,p.ans[i])).length,part:p,auto};
    session.results.push(r);
    p.items.forEach((x,i)=>{ if(isAnswered(x,p.ans[i])||session.kind==='bank') recordOutcome(x,isCorrect(x,p.ans[i]),session.kind==='bank'); });
    if(session.diff==='adaptive'&&SECTIONS[p.sec].gen){const acc=correct/p.items.length;const L=store.get('level',{});const cur=L[p.sec]||2;const nx=acc>=.85?Math.min(3,cur+1):acc<.6?Math.max(1,cur-1):cur;r.level=[cur,nx];if(nx!==cur){L[p.sec]=nx;store.set('level',L);}}
    if(session.kind!=='bank'){const log=store.get('log',[]); log.push({ts:Date.now(),sec:p.sec,diff:session.diff||'mixed',mode:session.kind==='mock'?'mock':session.drill?'drill':'timed',mock:session.kind==='mock'?session.mock:null,correct,total:r.total,secs,answered:r.answered}); store.set('log',log);}
    if(p.sec==='subj'&&session.kind!=='bank'){const ql=store.get('qlog',[]);p.items.forEach((x,i)=>ql.push({pid:x.pid,qi:x.qi,area:x.area,t:x.t,ok:isCorrect(x,p.ans[i]),ts:Date.now()}));store.set('qlog',ql);}
    if(p.sec==='subj'&&p.pids){const seen=store.get('seenP',{});p.pids.forEach(id=>{const its=p.items.map((x,i)=>[x,i]).filter(([x])=>x.pid===id);seen[id]={c:its.filter(([x,i])=>isCorrect(x,p.ans[i])).length,t:its.length};});store.set('seenP',seen);}
  }
  if(session.pi<session.parts.length-1){ session.pi++; startPart(); }
  else { stopTimer(); session.finished=true; if(session.task)taskDone(session.task); render(); window.scrollTo({top:0}); }
}
function renderResults(){
  const R=session.results; if(!R.length)return `<div class="panel stack"><h2>Session ended</h2><div class="row"><button class="btn primary" data-act="again">Back</button></div></div>`; const C=R.reduce((s,r)=>s+r.correct,0), T=R.reduce((s,r)=>s+r.total,0);
  const pct=T?Math.round(100*C/T):0;
  const levelMsg=R.filter(r=>r.level).map(r=>r.level[1]>r.level[0]?`<span class="tag good">${SECTIONS[r.sec].name}: level up to ${r.level[1]}</span>`:r.level[1]<r.level[0]?`<span class="tag warn">${SECTIONS[r.sec].name}: back to level ${r.level[1]}</span>`:`<span class="tag">${SECTIONS[r.sec].name}: staying at level ${r.level[1]}</span>`).join(' ');
  const rows=R.map(r=>`<tr><td>${SECTIONS[r.sec].name}</td><td class="n">${r.correct}/${r.total}</td><td class="n">${Math.round(100*r.correct/r.total)}%</td><td class="n">${r.answered}/${r.total}</td><td class="n">${fmt(r.secs)}</td><td class="n">${Math.round(r.secs/Math.max(1,r.total))} s</td></tr>`).join('');
  const review=R.map(r=>{const p=r.part; return `<h3 style="margin-top:10px">${SECTIONS[r.sec].name} — review</h3>`+p.items.map((it,i)=>{const ok=isCorrect(it,p.ans[i]);const a=p.ans[i];let inner='';
     if(it.type==='latin')inner=`<p>Your answer: <b>${a??'—'}</b></p>${explainLatin(it)}`;
     if(it.type==='eq')inner=`<div class="eqs">${it.eqs.map(e=>`<div>${esc(e)}</div>`).join('')}</div><p>Your answer: <b class="mono">${a?it.names.map((n,k)=>`${n}=${a[k]||'—'}`).join(', '):'—'}</b></p>${explainEq(it)}`;
     if(it.type==='fig')inner=renderFig(it,a,true);
     if(it.type==='subj')inner=`<p class="eyebrow">${esc(PBY[it.pid].title)} · ${QTYPES[it.t]||''}</p><p style="font-weight:600">${it.q}</p><p>Your answer: <b>${a!=null?'abcd'[a]+') '+it.o[a]:'—'}</b> · Correct: <b>${'abcd'[it.a]}) ${it.o[it.a]}</b></p>${subjExplain(it)}`;
     return `<details class="reviewitem" ${!ok&&isAnswered(it,a)?'open':''}><summary><span class="tag ${ok?'good':'bad'}">${ok?'correct':isAnswered(it,a)?'wrong':'unanswered'}</span> Item ${i+1} <span class="${p.itemT[i]>1.6*(SECTIONS[r.sec].target||75)?'tag warn':'muted mono'}">${Math.round(p.itemT[i])} s</span>${it.diff?`<span class="muted"> · ${it.diff}</span>`:''}</summary>${inner}</details>`}).join('');}).join('');
  return `<div class="stack"><div class="panel stack"><p class="eyebrow">${session.kind==='mock'?'Mock exam result':'Session result'}</p>
  <div class="kpis"><div><div class="big">${pct}%</div><span class="muted">${C} of ${T} correct</span></div></div>
  <div class="scroll-x"><table class="data"><tr><th>Section</th><th>Score</th><th>Accuracy</th><th>Answered</th><th>Time</th><th>Per item</th></tr>${rows}</table></div>
  ${levelMsg?`<div class="row">${levelMsg}</div>`:''}
  <p class="muted">Guessing costs nothing in the dMAT instructions: an unanswered item is a guaranteed miss. Wrong answers are open below and have been added to your mistake bank.</p>
  <div class="row"><button class="btn primary" data-act="again">New session</button><button class="btn" data-go="progress">Progress</button></div></div>
  ${R.map(pacePanel).join('')}
  <div class="panel review">${review}</div></div>`;
}

/* ---------- PROGRESS ---------- */
function viewProgress(){
  const log=store.get('log',[]);
  if(!log.length)return `<div class="panel stack"><h2>No sessions yet</h2><p class="muted">Each practice or mock section you finish is logged here in this browser. Start with Day 1's diagnostic sets.</p><div><button class="btn primary" data-go="practice">Open practice</button></div></div>`;
  const stat=k=>{const L=log.filter(l=>l.sec===k&&l.mode!=='drill');const c=L.reduce((s,l)=>s+l.correct,0),t=L.reduce((s,l)=>s+l.total,0);const last=L.slice(-5);return {n:L.length,acc:t?c/t:null,secs:t?L.reduce((s,l)=>s+l.secs,0)/t:null,trend:last.map(l=>l.correct/l.total)}};
  const S=['fig','eq','latin','subj'].map(k=>({k,...stat(k)}));
  const withData=S.filter(s=>s.acc!=null); const weak=withData.length?withData.reduce((a,b)=>a.acc<b.acc?a:b):null;
  const spark=tr=>{if(tr.length<2)return '';const w=90,h=24;const pts=tr.map((v,i)=>`${(i/(tr.length-1))*w},${h-v*h}`).join(' ');return `<svg width="${w}" height="${h+2}" viewBox="0 -1 ${w} ${h+2}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/><circle cx="${w}" cy="${h-tr[tr.length-1]*h}" r="3" fill="var(--accent)"/></svg>`;};
  const rows=S.map(s=>`<tr><td>${SECTIONS[s.k].name}${weak&&weak.k===s.k?' <span class="tag bad">focus</span>':''}</td><td class="n">${s.n}</td><td>${s.acc==null?'<span class="muted">—</span>':`<div class="row" style="gap:8px;flex-wrap:nowrap"><div class="bar" style="width:100px"><i style="width:${Math.round(s.acc*100)}%"></i></div><span class="mono">${Math.round(s.acc*100)}%</span></div>`}</td><td class="n">${s.secs==null?'—':Math.round(s.secs)+' s'}</td><td>${spark(s.trend)}</td></tr>`).join('');
  const hist=log.slice().reverse().slice(0,40).map(l=>`<tr><td class="n">${new Date(l.ts).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td>${SECTIONS[l.sec].name}</td><td>${l.mode}${l.mock?` (${l.mock})`:''}</td><td>${l.diff}</td><td class="n">${l.correct}/${l.total}</td><td class="n">${fmt(l.secs)}</td></tr>`).join('');
  return `<div class="stack"><div class="panel stack"><p class="eyebrow">Timed and mock sessions (drills excluded)</p><h2>${weak?`Focus area: ${SECTIONS[weak.k].name}`:'Progress'}</h2>
  <p class="muted">For the core sections, aim for 85% or better at 75 seconds per item or less.</p>
  <div class="scroll-x"><table class="data"><tr><th>Section</th><th>Sessions</th><th>Accuracy</th><th>Avg time / item</th><th>Last 5</th></tr>${rows}</table></div></div>
  ${subjBreakdown()}
  <div class="panel stack"><h3>History</h3><div class="scroll-x"><table class="data"><tr><th>When</th><th>Section</th><th>Mode</th><th>Level</th><th>Score</th><th>Time</th></tr>${hist}</table></div>
  <p class="muted">${Sync.ref?'Your progress syncs to your Claude account automatically, so it follows you to other devices. The code below is a manual backup.':'Progress is saved in this browser. To move it to another browser or device, copy the backup code below and import it there.'}</p>
  <div class="row"><button class="btn" data-act="export">Copy progress code</button><button class="btn ghost" data-act="import">Import code</button></div>
  <label for="codebox" class="muted" hidden>Progress code</label><textarea id="codebox" hidden rows="3" style="width:100%;font-family:var(--mono);font-size:12px;background:var(--sunk);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px"></textarea><p id="codemsg" class="muted"></p></div></div>`;
}

function subjBreakdown(){
  const ql=store.get('qlog',[]); if(!ql.length)return '';
  const agg=(key,labels)=>Object.entries(labels).map(([k,v])=>{const L=ql.filter(x=>x[key]===k);const c=L.filter(x=>x.ok).length;return {k,v,n:L.length,acc:L.length?c/L.length:null};});
  const tbl=(rows,title)=>`<div class="stack" style="gap:6px"><h3>${title}</h3><div class="scroll-x"><table class="data"><tr><th>${title.split(' ').pop()}</th><th>Questions</th><th>Accuracy</th></tr>${rows.map(r=>`<tr><td>${r.v}</td><td class="n">${r.n}</td><td>${r.acc==null?'<span class="muted">—</span>':`<div class="row" style="gap:8px;flex-wrap:nowrap"><div class="bar" style="width:100px"><i style="width:${Math.round(r.acc*100)}%"></i></div><span class="mono">${Math.round(r.acc*100)}%</span></div>`}</td></tr>`).join('')}</table></div></div>`;
  const A=agg('area',AREAS), T=agg('t',QTYPES);
  const weakest=[...A,...T].filter(r=>r.n>=4).sort((a,b)=>a.acc-b.acc)[0];
  return `<div class="panel stack"><p class="eyebrow">Subject Module · every answered question</p><h2>${weakest?`Weakest spot: ${weakest.v} (${Math.round(weakest.acc*100)}%)`:'Subject Module breakdown'}</h2>${weakest?`<p class="muted">Open Trick cards and review the cards for ${weakest.v}, then run a drill on it from Practice.</p>`:''}<div class="grid2">${tbl(A,'By subject')}${tbl(T,'By question type')}</div></div>`;
}

/* ---------- TRICK CARDS ---------- */
let cardFilter='review';
function cardState(i){const v=store.get('cards',{})[i];if(!v)return {box:0,due:0};if(v==='got')return {box:1,due:0};if(v==='again')return {box:0,due:0};return v;}
function gradeCard(i,how){const st=store.get('cards',{});const c=cardState(i);const now=Date.now();
  if(how==='got'){const box=Math.min(4,c.box+1);st[i]={box,due:now+[1,3,7,14][box-1]*DAY,u:now};}else{st[i]={box:0,due:now,u:now};}
  store.set('cards',st);}
function cardsDue(){const now=Date.now();return TRICKS.filter((c,i)=>{const s=cardState(i);return s.box===0||s.due<=now;}).length;}
function viewTricks(){
  const groups=[...new Set(TRICKS.map(t=>t.g))]; const now=Date.now();
  const list=TRICKS.map((c,i)=>({...c,i,s:cardState(i)})).filter(c=>cardFilter==='all'||(cardFilter==='review'?(c.s.box===0||c.s.due<=now):c.g===cardFilter));
  const mastered=TRICKS.filter((c,i)=>cardState(i).box>=3).length;
  const nextIn=s=>{const d=Math.ceil((s.due-now)/DAY);return d<=0?'due now':d===1?'back tomorrow':`back in ${d} days`;};
  return `<div class="stack"><div class="panel stack"><div class="row" style="justify-content:space-between"><div><p class="eyebrow">5 minutes before each study block</p><h2>Trick cards</h2></div><div class="row" style="gap:6px"><span class="tag warn">${cardsDue()} to review</span><span class="tag good">${mastered} / ${TRICKS.length} mastered</span></div></div>
  <p class="muted" style="max-width:64ch">Say the trick out loud, then check it. <b>Got it</b> brings the card back after 1, then 3, 7 and 14 days. <b>Again</b> keeps it in today's pile. A card counts as mastered after three correct recalls in a row.</p>
  <div class="seg"><button data-cardfilter="review" aria-pressed="${cardFilter==='review'}">To review</button><button data-cardfilter="all" aria-pressed="${cardFilter==='all'}">All</button>${groups.map(g=>`<button data-cardfilter="${esc(g)}" aria-pressed="${cardFilter===g}">${esc(g)}</button>`).join('')}</div></div>
  <div class="grid2">${list.map(c=>`<div class="card"><div class="row" style="justify-content:space-between;gap:6px"><span class="eyebrow">${esc(c.g)}</span>${c.s.box>=3?'<span class="tag good">Mastered</span>':c.s.box>0?`<span class="tag">${nextIn(c.s)}</span>`:''}</div><h3>${esc(c.f)}</h3><button class="reveal" data-cardflip="${c.i}">Show the trick</button><p id="cb-${c.i}" hidden class="explain">${esc(c.b)}</p><div class="small"><button data-card="${c.i}" data-cardset="got">✓ Got it</button><button data-card="${c.i}" data-cardset="again">↻ Again</button></div></div>`).join('')||'<div class="panel"><h3>All caught up</h3><p class="muted">No cards are due. Come back tomorrow, or browse All.</p></div>'}</div></div>`;
}

/* ---------- GUIDE ---------- */
function viewGuide(){
  return `<div class="stack"><div class="panel stack"><p class="eyebrow">Exam format (from the official preparatory materials, as of September 2026)</p><h2>What you are facing</h2>
  <div class="scroll-x"><table class="data"><tr><th>Part</th><th>Items</th><th>Time</th><th>Pace</th></tr>
  <tr><td>Figure Sequences</td><td class="n">20</td><td class="n">25 min</td><td class="n">75 s</td></tr>
  <tr><td>Mathematical Equations</td><td class="n">20</td><td class="n">25 min</td><td class="n">75 s</td></tr>
  <tr><td>Latin Squares</td><td class="n">20</td><td class="n">25 min</td><td class="n">75 s</td></tr>
  <tr><td>Break</td><td></td><td class="n">30 min</td><td></td></tr>
  <tr><td>Subject Module (General Academic)</td><td>texts + single-choice questions</td><td class="n">90 min</td><td>—</td></tr></table></div>
  <p class="muted">No notes are allowed at any point. If unsure, guess. Each question has exactly one correct answer.</p></div>
  <div class="grid2">
  <div class="panel stack"><h3>Figure Sequences</h3><ul>
  <li>Track <b>one figure at a time</b>: position → rotation → colour.</li>
  <li>Movement types: straight line (bounces), diagonal (bounces back the same way), outer-border walk (clockwise / counter-clockwise, 1 or 2 fields), direction cycle (e.g. left, up, right, down).</li>
  <li><b>x + 1</b>: steps or turns grow 1, 2, 3, 4… Image 5 = +4, image 6 = +5 from the previous one.</li>
  <li>For the border walk, the outer ring of a 4×4 grid has 12 fields. Count modulo 12.</li>
  <li>Figures never overlap or disappear. An option with an overlap is always wrong.</li>
  <li>Eliminate: find the figure the three options disagree on, and check only that one.</li></ul></div>
  <div class="panel stack"><h3>Mathematical Equations</h3><ul>
  <li>All values are integers 1–20. Use that to prune: "B ÷ 2 = A" ⇒ B is even and ≤ 20, so A ≤ 10.</li>
  <li>Start from the equation with one unknown, or one that defines a letter ("5 × B = A").</li>
  <li>Substitute everything into the longest equation to get one unknown (like PDF ex. 5: 13B − 11 = 2).</li>
  <li>Watch signs when a bracket follows a minus: A − (11 + B) = A − 11 − B.</li>
  <li>Always check the final values in <b>every</b> equation. It takes 5 seconds and catches most slips.</li>
  <li>Drill: times tables to 20 × 5, squares to 20², halving and doubling.</li></ul></div>
  <div class="panel stack"><h3>Latin Squares</h3><ul>
  <li>First scan the <b>row and column of the ?</b>. If four different letters appear there, you are done.</li>
  <li>Otherwise find the fullest row or column that crosses the target line and complete it.</li>
  <li>Hidden single: "Where can the missing D go in this row?" If only one cell survives the column check, fill it.</li>
  <li>Count letters: a letter already placed 4 times has exactly one spot left.</li>
  <li>Hold at most 2–3 filled cells in memory. Say them silently ("β4 is D") to keep them.</li>
  <li>Budget 60 s. If you are stuck, guess from the letters that are still possible and move on.</li></ul></div>
  <div class="panel stack"><h3>Subject Module</h3><ul>
  <li>Answers come from the text. Read the question first, then scan the text for the relevant formula or definition.</li>
  <li>Many questions are ratio or scaling questions ("if S doubles, Q* grows by √2"). Reason with proportions instead of full calculations.</li>
  <li>Estimate: options are often an order of magnitude apart (1, 10, 100, 1,000 bar).</li>
  <li>Watch units: °C vs K, km/h vs m/s, kJ vs kW.</li>
  <li>Eliminate options that contradict the text's stated assumptions.</li>
  <li>Budget about 2 minutes per question, and never leave one blank.</li></ul></div>
  </div>
  <div class="panel stack res"><h3>Official and public resources</h3><ul>
  <li><a href="https://www.d-mat.de/en/preparation-for-the-exam/" target="_blank" rel="noopener">dMAT — Preparation for the exam</a>: tutorial videos (introduction, the 3 core task types, subject module) plus other subject-module PDFs</li>
  <li><a href="https://www.d-mat.de/en/" target="_blank" rel="noopener">dMAT official site</a>: test dates, registration, test centres and results</li>
  <li><a href="https://www.testas.de/fileadmin/bilder/4_pdf-video/1-teilnehmende/230531_digitalertestas_preparatory_materials.pdf" target="_blank" rel="noopener">Digital TestAS preparatory materials (PDF)</a>: same organisation (g.a.s.t.) and the same three core task types, so more official examples</li>
  <li><a href="https://www.testas.de/en/teilnehmende/the-digital-testas/preparing-for-the-digital-testas" target="_blank" rel="noopener">TestAS preparation page</a>: tutorial videos for Figure Sequences, Equations and Latin Squares</li>
  <li><a href="https://www.jobtestprep.de/testas-sample-digital" target="_blank" rel="noopener">JobTestPrep free digital TestAS sample</a>: extra core-module items (third-party)</li>
  <li><a href="https://www.preparebuddy.com/features/dmat/" target="_blank" rel="noopener">PrepareBuddy dMAT practice</a> and <a href="https://www.edmaster.co/coaching/dmat/" target="_blank" rel="noopener">EdMaster free dMAT test</a>: third-party practice (quality unverified)</li>
  <li>Subject-module refreshers: Khan Academy units on statistics, exponential functions, vectors, basic physics and microeconomics</li></ul></div></div>`;
}

/* ---------- events ---------- */
function bindView(){
  const v=$('#view');
  v.onclick=e=>{
    const b=e.target.closest('button,[data-plan],a[data-task]'); if(!b)return;
    const d=b.dataset;
    if(d.go)return setTab(d.go);
    if(d.sec){pr.sec=d.sec;return render();}
    if(d.diff){pr.diff=d.diff;return render();}
    if(d.mode){pr.mode=d.mode;return render();}
    if(d.pid){pr.pid=d.pid;pr.skind='test';return render();}
    if(d.bankset){pr.bankset=d.bankset;return render();}
    if(d.examday){store.set('examday',!examDay());return render();}
    if(d.explain!=null){return explainAI(b);}
    if(d.task){return runTask(d.task);}
    if(d.tick){const [dd,ii]=d.tick.split('|');const T=store.get('todaydone',{});T[dd]=T[dd]||{};T[dd][ii]=T[dd][ii]==='manual'?null:'manual';store.set('todaydone',T);return render();}
    if(d.bankgo){pr.sec='bank';pr.bankset=d.bankgo;return setTab('practice');}
    if(d.area){pr.area=d.area;pr.pid=null;if(pr.skind!=='type')pr.skind='test';return render();}
    if(d.smode){pr.smode=d.smode;return render();}
    if(d.marathon){pr.skind='marathon';return render();}
    if(d.qtype){pr.skind='type';pr.qtype=d.qtype;return render();}
    if(d.card!=null){gradeCard(+d.card,d.cardset);return render();}
    if(d.cardflip!=null){const el=document.getElementById('cb-'+d.cardflip);if(el)el.hidden=!el.hidden;return;}
    if(d.cardfilter){cardFilter=d.cardfilter;return render();}
    if(b.id==='startP')return startPractice();
    if(d.mock)return startMock(d.mock);
    if(!session)return actGlobal(d.act);
    const p=session.parts[session.pi];
    if(d.jump)return switchItem(+d.jump);
    if(d.latin){p.ans[p.idx]=d.latin;return renderSession();}
    if(d.mcq){p.ans[p.idx]=+d.mcq;return renderSession();}
    if(d.fig){const [k,j]=d.fig.split(':').map(Number);const a=p.ans[p.idx]||[null,null];a[k]=j;p.ans[p.idx]=a;return renderSession();}
    switch(d.act){
      case 'prev':return switchItem(p.idx-1);
      case 'next':return switchItem(p.idx+1);
      case 'check':p.checked.add(p.idx);return renderSession();
      case 'flag':p.flags.has(p.idx)?p.flags.delete(p.idx):p.flags.add(p.idx);return renderSession();
      case 'finish':{const un=p.items.filter((x,i)=>!isAnswered(x,p.ans[i])).length;if(un&&!p.armed){p.armed=true;b.textContent=`${un} unanswered — tap again to submit`;setTimeout(()=>{p.armed=false;},4000);return;}return finishPart(false);}
      case 'endbreak':return finishPart(false);
      case 'again':session=null;return render();
    }
    actGlobal(d.act);
  };
  v.oninput=e=>{const i=e.target.dataset.eq;if(i==null||!session)return;const p=session.parts[session.pi];const a=p.ans[p.idx]||p.items[p.idx].names.map(()=>'');a[+i]=e.target.value.replace(/\D/g,'');p.ans[p.idx]=a;
    const strip=$('.navstrip button.cur');if(strip)strip.classList.toggle('done',isAnswered(p.items[p.idx],a));
    const cb=$('[data-act="check"]');if(cb)cb.disabled=!isAnswered(p.items[p.idx],a);};
  const sf=document.getElementById('setupform'); if(sf){sf.onsubmit=saveSetup; sf.oninput=setupPreview; setupPreview();}
  v.onchange=e=>{const k=e.target.dataset.plan;if(!k)return;const done=store.get('plandone',{});done[k]=e.target.checked;store.set('plandone',done);render();};
  v.onkeydown=e=>{if(e.key==='Enter'&&e.target.dataset.eq!=null){const n=$(`#eq-${+e.target.dataset.eq+1}`);if(n)n.focus();else{const nb=$('[data-act="check"]')||$('[data-act="next"]');if(nb&&!nb.disabled)nb.click();}}};
}
function actGlobal(a){
  const box=$('#codebox'), msg=$('#codemsg');
  if(a==='reset'){const btn=document.querySelector('[data-act="reset"]');if(btn&&btn.dataset.armed!=='1'){btn.dataset.armed='1';btn.textContent='Tap again to erase everything';setTimeout(()=>{if(btn){btn.dataset.armed='';btn.textContent='Reset all progress';}},4000);return;}
    ['log','qlog','cards','plandone','seenP','mistakes','level','todaydone','prsel','examday'].forEach(k=>store.set(k,k==='log'||k==='qlog'?[]:{}));Sync.queue();render();return;}
  if(a==='export'){const code=btoa(unescape(encodeURIComponent(JSON.stringify({log:store.get('log',[]),plandone:store.get('plandone',{}),seenP:store.get('seenP',{}),qlog:store.get('qlog',[]),cards:store.get('cards',{})}))));box.hidden=false;box.value=code;box.select();
    try{navigator.clipboard.writeText(code).then(()=>msg.textContent='Copied. On the other device, paste it here and choose Import code.',()=>msg.textContent='Select the code above and copy it.');}catch(e){msg.textContent='Select the code above and copy it.';}}
  if(a==='import'){ if(box.hidden||!box.value.trim()){box.hidden=false;box.value='';box.focus();msg.textContent='Paste your code in the box, then choose Import code again.';return;}
    try{const o=JSON.parse(decodeURIComponent(escape(atob(box.value.trim()))));['log','plandone','seenP','qlog','cards'].forEach(k=>o[k]&&store.set(k,o[k]));render();}catch(e){msg.textContent='That code could not be read. Copy the whole code again and paste it.';}}
}
