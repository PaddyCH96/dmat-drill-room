/* ===== features: mistake bank, today, pacing, keys, AI ===== */
MORE2.forEach(p=>{PASSAGES.push(p);PBY[p.id]=p;});
function mkey(it){return it.type==='subj'?`s:${it.pid}:${it.qi}`:`${it.type}:${it.uid||Math.random().toString(36).slice(2,10)}`;}
function recordOutcome(it,ok,fromBank){
  const M=store.get('mistakes',{}); const k=it.bankKey||mkey(it); const now=Date.now(); const cur=M[k];
  if(!ok){
    let item; if(it.type==='subj')item={type:'subj',pid:it.pid,qi:it.qi}; else {item={...it}; delete item.bankKey;}
    M[k]={item,streak:0,due:now+DAY,u:now,added:cur&&!cur.removed?cur.added:now,misses:((cur&&cur.misses)||0)+1,removed:false,sec:it.type==='subj'?'subj':it.type};
    const core=Object.entries(M).filter(([kk,m])=>!m.removed&&m.sec!=='subj'&&m.sec===M[k].sec).sort((a,b)=>a[1].u-b[1].u);
    while(core.length>15){const [kk]=core.shift();M[kk]={...M[kk],removed:true,item:null,u:now};}
  } else if(fromBank&&cur&&!cur.removed){
    const streak=cur.streak+1; M[k]=streak>=2?{...cur,streak,removed:true,item:null,u:now}:{...cur,streak,due:now+2*DAY,u:now};
  } else return;
  store.set('mistakes',M);
}
function bankCounts(){const M=store.get('mistakes',{});const now=Date.now();const act=Object.values(M).filter(m=>!m.removed&&m.item);return {all:act.length,due:act.filter(m=>m.due<=now).length};}
function bankLabel(it){const m=store.get('mistakes',{})[it.bankKey];if(!m)return '';return m.streak===1?'1 more correct to clear':'2 correct answers to clear';}
function startBank(all,task){
  const M=store.get('mistakes',{});const now=Date.now();
  const pick=RNG.shuffle(Object.entries(M).filter(([k,m])=>!m.removed&&m.item&&(all||m.due<=now))).slice(0,15);
  if(!pick.length)return;
  const items=pick.map(([k,m])=>{const x=m.item.type==='subj'?subjItem(m.item.pid,m.item.qi):JSON.parse(JSON.stringify(m.item));x.bankKey=k;return x;});
  newSession({kind:'bank',drill:true,task,parts:[{sec:'mix',items,limit:null,target:items.length*90}]});
  if(examDay()){session.exam=false;session.drill=true;}
}
/* keyboard */
function keyHint(it,canCheck){
  const base=it.type==='latin'?'Keys: A–E answer':it.type==='subj'?'Keys: 1–4 or A–D answer':it.type==='fig'?'Keys: 1–3 image 1, 4–6 image 2':'Type numbers, Tab between boxes';
  return `${base} · ←/→ move · F flag${canCheck?' · Enter check':''}`;
}
document.addEventListener('keydown',e=>{
  if(!session||session.finished||e.metaKey||e.ctrlKey||e.altKey)return;
  const p=session.parts[session.pi]; if(!p||p.sec==='break')return;
  const it=p.items[p.idx]; const inInput=e.target&&e.target.tagName==='INPUT'; const k=e.key;
  const locked=session.drill&&p.checked.has(p.idx);
  const click=sel=>{const el=document.querySelector(sel);if(el&&!el.disabled){el.click();return true;}return false;};
  if(k==='ArrowRight'&&!inInput){if(p.idx<p.items.length-1){e.preventDefault();switchItem(p.idx+1);}return;}
  if(k==='ArrowLeft'&&!inInput){if(p.idx>0){e.preventDefault();switchItem(p.idx-1);}return;}
  if(k==='Enter'&&!inInput){if(click('[data-act="check"]')||click('[data-act="next"]'))e.preventDefault();return;}
  if(inInput)return;
  if(k==='f'||k==='F'){click('[data-act="flag"]');return;}
  if(locked)return;
  if(it.type==='latin'&&/^[a-eA-E]$/.test(k)){click(`[data-latin="${k.toUpperCase()}"]`);return;}
  if(it.type==='subj'){const m='1234'.indexOf(k)>=0?'1234'.indexOf(k):'abcd'.indexOf(k.toLowerCase());if(m>=0&&k.length===1)click(`[data-mcq="${m}"]`);return;}
  if(it.type==='fig'&&/^[1-6]$/.test(k)){const n=+k-1;click(`[data-fig="${n<3?0:1}:${n%3}"]`);return;}
});
/* AI explanations */
function aiBtn(it){ if(!AI.fn||(session&&session.exam&&!session.finished))return ''; if(!window.__aiItems)window.__aiItems=[]; window.__aiItems.push(it); const id=window.__aiItems.length-1;
  return `<div class="ai"><button class="btn ghost" data-explain="${id}">✦ Explain it differently</button><div class="ai-out" id="ai-${id}" hidden></div></div>`; }
function aiPrompt(it){
  const strip=h=>String(h).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  let task='';
  if(it.type==='subj'){const P=PBY[it.pid];task=`Reading passage "${P.title}":\n${strip(P.text)}\n\nQuestion: ${strip(it.q)}\nOptions:\n${it.o.map((o,j)=>`${'abcd'[j]}) ${strip(o)}`).join('\n')}\nCorrect answer: ${'abcd'[it.a]}) ${strip(it.o[it.a])}\nOfficial explanation: ${strip(it.e)}`;}
  if(it.type==='latin')task=`A 5x5 Latin square (letters A-E once per row and column). Rows (. = empty, columns α β γ δ ε):\n${it.grid.map((r,i)=>`${i+1}: ${r.map((x,j)=>i===it.tr&&j===it.tc?'?':(x||'.')).join(' ')}`).join('\n')}\nThe answer for ? is ${it.answer}. Deduction steps: ${it.steps.map(s=>s.why).join(' ')}`;
  if(it.type==='eq')task=`System of equations, each letter an integer 1-20:\n${it.eqs.join('\n')}\nSolution: ${it.names.map((n,i)=>n+'='+it.answer[i]).join(', ')}.`;
  if(it.type==='fig')task=`A figure-sequence puzzle on a 4x4 grid. The rules are: ${it.explain.join(' ')} The student must predict images 5 and 6.`;
  return `You are a patient tutor helping a student prepare for the dMAT (a German master's admission test) where notes are NOT allowed, so every method must work in one's head. Explain the solution below in a different way from the official explanation: use a short step-by-step mental method, one concrete memory hook, and one common trap to avoid. Plain text, at most 140 words, no markdown headings.\n\n${task}`;
}
async function explainAI(btn){
  const id=btn.dataset.explain; const it=(window.__aiItems||[])[+id]; const out=document.getElementById('ai-'+id); if(!it||!out||!AI.fn)return;
  btn.disabled=true; out.hidden=false; out.textContent='Thinking…';
  try{ const r=await AI.fn(aiPrompt(it),{onText:({text})=>{out.textContent=text;}}); out.textContent=r.text; btn.textContent='✦ Explained by Claude'; }
  catch(e){ if(e&&e.code==='not_granted'){out.textContent='Claude explanations are turned off for this page.';}else if(e&&e.code==='rate_limited'){out.textContent='Too many requests right now. Try again in a minute.';btn.disabled=false;}else{out.textContent=(e&&e.text)||'Could not get an explanation. Try again.';btn.disabled=false;} }
}
/* pacing */
function pacePanel(r){
  const p=r.part; if(!p||!p.items.length)return '';
  const target=SECTIONS[r.sec].target||75; const n=p.items.length;
  const rows=p.items.map((x,i)=>({t:p.itemT[i],ok:isCorrect(x,p.ans[i]),ans:isAnswered(x,p.ans[i])}));
  const ans=rows.filter(x=>x.ans); const acc=ans.length?ans.filter(x=>x.ok).length/ans.length:0;
  const fast=ans.filter(x=>x.t<0.35*target), slow=rows.filter(x=>x.t>1.6*target);
  const pc=a=>a.length?Math.round(100*a.filter(x=>x.ok).length/a.length):0;
  const msgs=[];
  if(fast.length>=3&&pc(fast)/100<acc-0.15)msgs.push(['warn',`Rushing: ${fast.length} quick answers (under ${Math.round(0.35*target)} s) were only ${pc(fast)}% correct. Spend 10 more seconds checking.`]);
  if(slow.length>=3&&pc(slow)<50)msgs.push(['warn',`Overthinking: ${slow.length} items took over ${Math.round(1.6*target)} s and only ${pc(slow)}% were right. Guess, flag and move on sooner.`]);
  if(r.answered<r.total&&p.limit)msgs.push(['bad',`Time ran out with ${r.total-r.answered} unanswered. Always leave the last minute to guess the rest.`]);
  if(!msgs.length)msgs.push(['good',`Good pacing: an average of ${Math.round(r.secs/n)} s per item against a ${target} s target.`]);
  const W=Math.max(260,n*18), H=110, maxT=Math.max(target*2,...rows.map(x=>x.t))||1; const bw=W/n;
  const y=v=>H-8-(Math.min(v,maxT)/maxT)*(H-24);
  const bars=rows.map((x,i)=>`<rect x="${i*bw+2}" y="${y(x.t)}" width="${Math.max(3,bw-4)}" height="${H-8-y(x.t)}" rx="2" fill="${!x.ans?'var(--grid)':x.ok?'var(--good)':'var(--bad)'}"><title>Item ${i+1}: ${Math.round(x.t)} s, ${!x.ans?'unanswered':x.ok?'correct':'wrong'}</title></rect>`).join('');
  return `<div class="panel stack" style="gap:12px"><div class="row" style="justify-content:space-between"><h3>Pacing · ${SECTIONS[r.sec].name}</h3><span class="muted" style="font-size:14px">Bars: seconds per item · <span style="color:var(--good)">■</span> right <span style="color:var(--bad)">■</span> wrong <span style="color:var(--grid)">■</span> unanswered · dashed line = ${target} s target</span></div>
  ${msgs.map(([c,m])=>`<p class="tag ${c}" style="align-self:flex-start;white-space:normal;font-size:14.5px;padding:6px 12px">${m}</p>`).join('')}
  <div class="scroll-x"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Seconds per item">${bars}<line x1="0" x2="${W}" y1="${y(target)}" y2="${y(target)}" stroke="var(--ink)" stroke-dasharray="4 4" opacity=".5"/><line x1="0" x2="${W}" y1="${H-8}" y2="${H-8}" stroke="var(--line)"/></svg></div></div>`;
}
/* today */
const todayStr=()=>ymd(new Date());
function actLabel(a){
  const sn={fig:'Figure Sequences',eq:'Equations',latin:'Latin Squares'};
  if(a.k==='core')return `${sn[a.sec]} · ${a.mode==='timed'?'timed set':'drill'}${a.diff==='high'||a.diff==='low'||a.diff==='medium'?' · '+a.diff:''}`;
  if(a.k==='subj')return `${a.n} subject tests`; if(a.k==='bank')return 'Redo mistakes'; if(a.k==='cards')return `Trick cards${a.g?' · '+a.g:''}`;
  if(a.k==='link')return 'Open official videos'; if(a.k==='tab')return 'Open tactics'; if(a.k==='weak')return `Weakest section · timed set`;
  if(a.k==='block')return 'Core block · 3 × 25 min'; if(a.k==='mock')return a.m==='mock1'?'Start Mock 1':a.m==='mock2'?'Start Mock 2':'Start core mock'; return '';
}
function weakestCore(){const log=store.get('log',[]);let best=null;['fig','eq','latin'].forEach(k=>{const L=log.filter(l=>l.sec===k&&l.mode!=='drill');const t=L.reduce((s,l)=>s+l.total,0);const acc=t?L.reduce((s,l)=>s+l.correct,0)/t:0.5;if(!best||acc<best.acc)best={k,acc};});return best.k;}
function nextSubjectTests(n){
  const seen=store.get('seenP',{}); const order=['econ','biz','soc','chembio','stats','math','cs','phys'];
  const pool=PASSAGES.filter(p=>!MOCK_OF[p.id]&&!seen[p.id]).sort((a,b)=>order.indexOf(a.area)-order.indexOf(b.area));
  const out=[];const used=new Set();for(const p of pool){if(out.length>=n)break;if(!used.has(p.area)||pool.length-out.length<=n){out.push(p.id);used.add(p.area);}}
  for(const p of pool){if(out.length>=n)break;if(!out.includes(p.id))out.push(p.id);}
  if(out.length<n){PASSAGES.filter(p=>!MOCK_OF[p.id]&&!out.includes(p.id)).sort((a,b)=>(seen[a.id].c/seen[a.id].t)-(seen[b.id].c/seen[b.id].t)).slice(0,n-out.length).forEach(p=>out.push(p.id));}
  return out;
}
function taskCount(d,i,j){const T=store.get('todaydone',{});const v=((T[d]||{})[i+'.'+j])||0;return v;}
function taskDone(t){const T=store.get('todaydone',{});T[t.d]=T[t.d]||{};const k=t.i+'.'+t.j;T[t.d][k]=(T[t.d][k]||0)+1;store.set('todaydone',T);}
function itemDone(d,i){const acts=(TASKS[d]||[])[i]||[];const T=(store.get('todaydone',{})[d])||{};if(T[i]==='manual')return true;const real=acts.filter(a=>a.k!=='none');return real.length>0&&real.every((a,j)=>(T[i+'.'+j]||0)>=(a.n||1));}
function runTask(ref){
  const [d,i,j]=ref.split('|'); const a=TASKS[d][+i][+j]; const task={d,i:+i,j:+j};
  const ex=examDay();
  if(a.k==='core'){pr.sec=a.sec;pr.diff=a.diff;pr.mode=a.mode;tab='practice';return startPractice(task);}
  if(a.k==='weak'){pr.sec=weakestCore();pr.diff='adaptive';pr.mode='timed';tab='practice';return startPractice(task);}
  if(a.k==='subj'){const ids=nextSubjectTests(a.n);tab='practice';return newSession({kind:'practice',drill:false,task,parts:[{sec:'subj',items:buildSubject(ids),limit:ids.length*13*60,target:ids.length*13*60,pids:ids}]});}
  if(a.k==='bank'){const c=bankCounts();tab='practice';if(!c.all){taskDone(task);return render();}return startBank(c.due===0,task);}
  if(a.k==='block'){tab='practice';return newSession({kind:'practice',drill:false,diff:'adaptive',task,parts:['fig','eq','latin'].map(s=>({sec:s,items:buildCore(s,'adaptive',20),limit:25*60}))});}
  if(a.k==='mock'){tab='mock';return startMock(a.m,task);}
  taskDone(task);
  if(a.k==='cards'){cardFilter=a.g||'review';return setTab('tricks');}
  if(a.k==='tab')return setTab(a.t);
  if(a.k==='link'){setTimeout(render,50);return;}
}
function viewToday(){
  const S=getSetup(); let d=todayStr(); const days=PLAN.map(p=>p.d); let note='';
  if(days.length&&d<days[0]){note=`Your plan starts on ${fmtDate(days[0])}. Here's Day 1 so you can preview it.`;d=days[0];}
  const exam=d===S.exam, after=d>S.exam;
  const bc=bankCounts(), cd=cardsDue();
  const quick=`<div class="grid2">
    <div class="card"><span class="eyebrow">Mistake bank</span><h3>${bc.due} due · ${bc.all} total</h3><p class="muted" style="font-size:15px">Questions you got wrong come back a day later.</p><div class="row"><button class="btn ${bc.due?'primary':''}" data-bankgo="${bc.due?'due':'all'}" ${bc.all?'':'disabled'}>Redo mistakes</button></div></div>
    <div class="card"><span class="eyebrow">Trick cards</span><h3>${cd} to review</h3><p class="muted" style="font-size:15px">Five minutes of recall before you start.</p><div class="row"><button class="btn" data-go="tricks">Review cards</button></div></div>
    <div class="card"><span class="eyebrow">Your levels</span><h3>${['fig','eq','latin'].map(k=>({fig:'Fig',eq:'Eq',latin:'Latin'}[k])+' '+((store.get('level',{})[k])||2)).join(' · ')}</h3><p class="muted" style="font-size:15px">Adaptive sets move you up at 85%+ and down below 60%.</p><div class="row"><button class="btn" data-go="progress">See progress</button></div></div></div>`;
  if(exam||after)return `<div class="stack"><div class="panel stack"><p class="eyebrow">${exam?parseYmd(S.exam).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}):'After the exam'}</p><h2>${exam?'Exam day. You\'ve done the work.':'The exam is behind you'}</h2>${exam?`<ul class="clean"><li>Morning: one relaxed 10-minute drill, then stop.</li><li>Bring your admission confirmation and ID; arrive early.</li><li>Core 90 min → 30 min break → Subject 90 min. No notes. Never leave a question blank.</li></ul><div class="row"><button class="btn" data-go="tricks">Glance at trick cards</button></div>`:`<p class="muted">Results are usually published a couple of weeks after the test. Taking another dMAT? Set a new date in Settings.</p><div class="row"><button class="btn primary" data-go="setup">Set a new exam date</button></div>`}</div></div>`;
  const pi=days.indexOf(d); if(pi<0)return `<div class="panel"><h2>Nothing scheduled today</h2><div class="row" style="margin-top:12px"><button class="btn primary" data-go="practice">Open practice</button></div></div>`;
  const P=PLAN[pi]; const acts=TASKS[d]||[]; const nDone=P.items.filter((x,i)=>itemDone(d,i)).length;
  const rows=P.items.map((txt,i)=>{const done=itemDone(d,i);const m=txt.match(/^(\d\d:\d\d)\s(.*)$/);const time=m?m[1]:'';const body=m?m[2]:txt;
    const btns=(acts[i]||[]).map((a,j)=>{if(a.k==='none')return '';const c=taskCount(d,i,j),n=a.n||1;const full=c>=n;
      if(a.k==='link')return `<a class="btn ${full?'':'primary'} sm" href="${a.url}" target="_blank" rel="noopener" data-task="${d}|${i}|${j}">${full?'✓ ':''}${actLabel(a)}</a>`;
      return `<button class="btn ${full?'':'primary'} sm" data-task="${d}|${i}|${j}">${full?'✓ ':''}${actLabel(a)}${n>1?` · ${Math.min(c,n)}/${n}`:''}</button>`;}).join('');
    return `<div class="task ${done?'done':''}"><button class="tick" data-tick="${d}|${i}" aria-pressed="${done}" aria-label="Mark step done">${done?'✓':''}</button><div class="stack" style="gap:8px"><p><span class="mono muted" style="font-size:14px">${time}</span> ${esc(body)}</p>${btns?`<div class="row" style="gap:8px">${btns}</div>`:''}</div></div>`;}).join('');
  return `<div class="stack">${note?`<p class="tag warn" style="align-self:flex-start">${note}</p>`:''}
  <div class="panel stack"><div class="row" style="justify-content:space-between"><div><p class="eyebrow">Day ${pi+1} of ${PLAN.length} · ${parseYmd(d).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</p><h2>${esc(P.t)}</h2></div><div class="progressring" style="--p:${Math.round(100*nDone/P.items.length)}"><span>${nDone}/${P.items.length}</span></div></div>
  <div class="tasks">${rows}</div>
  <p class="muted" style="font-size:14.5px">Buttons start the exact session for each step, and steps tick off when you finish them. You can also tick a step yourself.</p></div>
  ${quick}</div>`;
}
buildPlan(); countdown(); render(); Sync.init().then(()=>{buildPlan();countdown();if(!session)render();}); AI.init();
