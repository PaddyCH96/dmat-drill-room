/* ---------------------------------------------------------------------------
 * generators.js — the three Core Module puzzle generators.
 *
 * Every item is produced fresh, so practice never runs out:
 *   genLatin(difficulty)     5x5 grid, letters A–E once per row and column.
 *                            Cells are removed only while the marked cell can
 *                            still be deduced, and the deduction path is kept
 *                            so the app can explain the answer step by step.
 *   genEquations(difficulty) A system of 2–4 equations over the integers 1–20,
 *                            brute-force checked to have exactly one solution.
 *   genFigures(difficulty)   A 4x4 matrix sequence following the official rules
 *                            (straight and diagonal movement with bounces,
 *                            border walks, x + 1 steps, rotation, colour), plus
 *                            three distinct options for each of images 5 and 6.
 *
 * Difficulty is 'low' | 'medium' | 'high'. Each generator retries until it has
 * a valid item, so callers never see a malformed one. tests/check.mjs verifies
 * uniqueness and the no-overlap rule on hundreds of generated items.
 * ------------------------------------------------------------------------- */
/* ===== dMAT practice engine: generators ===== */
const RNG = {
  int:(a,b)=>a+Math.floor(Math.random()*(b-a+1)),
  pick:a=>a[Math.floor(Math.random()*a.length)],
  shuffle:a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
};

/* ---------- LATIN SQUARES ---------- */
const LETTERS=['A','B','C','D','E'];
function fullLatin(){
  const rows=RNG.shuffle([0,1,2,3,4]), cols=RNG.shuffle([0,1,2,3,4]), sym=RNG.shuffle(LETTERS);
  return rows.map(r=>cols.map(c=>sym[(r+c)%5]));
}
const COLN=['α','β','γ','δ','ε'];
function cellName(r,c){return COLN[c]+(r+1);}
// propagate singles; returns {steps:[...], grid, solvedTarget:boolean, stepsToTarget}
function lsSolve(grid,tr,tc){
  const g=grid.map(r=>r.slice()); const steps=[];
  const cand=(r,c)=>LETTERS.filter(L=>!g[r].includes(L)&&!g.map(x=>x[c]).includes(L));
  let progress=true;
  while(progress){
    progress=false;
    // naked singles
    for(let r=0;r<5&&!progress;r++)for(let c=0;c<5&&!progress;c++){
      if(g[r][c])continue; const k=cand(r,c);
      if(k.length===0)return {fail:true};
      if(k.length===1){g[r][c]=k[0];steps.push({r,c,v:k[0],why:`${cellName(r,c)} = ${k[0]}: every other letter already appears in row ${r+1} or column ${COLN[c]}.`});progress=true;}
    }
    if(progress){ if(g[tr][tc])break; continue;}
    // hidden singles in rows / cols
    for(let u=0;u<5&&!progress;u++)for(const L of LETTERS){
      if(!g[u].includes(L)){
        const spots=[0,1,2,3,4].filter(c=>!g[u][c]&&cand(u,c).includes(L));
        if(spots.length===1){const c=spots[0];g[u][c]=L;steps.push({r:u,c,v:L,why:`${cellName(u,c)} = ${L}: row ${u+1} still needs ${L} and this is the only open cell where ${L} is not blocked by its column.`});progress=true;break;}
      }
      const col=g.map(x=>x[u]);
      if(!col.includes(L)){
        const spots=[0,1,2,3,4].filter(r=>!g[r][u]&&cand(r,u).includes(L));
        if(spots.length===1){const r=spots[0];g[r][u]=L;steps.push({r,c:u,v:L,why:`${cellName(r,u)} = ${L}: column ${COLN[u]} still needs ${L} and this is the only open cell where ${L} is not blocked by its row.`});progress=true;break;}
      }
    }
    if(g[tr][tc])break;
  }
  return {grid:g,steps,solved:!!g[tr][tc]};
}
function genLatin(diff){
  const range={low:[1,1],medium:[2,4],high:[5,12]}[diff];
  const givensRange={low:[12,17],medium:[10,14],high:[8,12]}[diff];
  for(let attempt=0;attempt<400;attempt++){
    const full=fullLatin(); const tr=RNG.int(0,4), tc=RNG.int(0,4);
    const g=full.map(r=>r.slice()); g[tr][tc]=null;
    const cells=RNG.shuffle([...Array(25).keys()].filter(i=>i!==tr*5+tc));
    let best=null;
    for(const i of cells){
      const r=Math.floor(i/5),c=i%5, keep=g[r][c]; g[r][c]=null;
      const s=lsSolve(g,tr,tc);
      if(!s.solved){g[r][c]=keep;continue;}
      const givens=g.flat().filter(Boolean).length;
      const n=s.steps.length;
      if(n>=range[0]&&n<=range[1]&&givens>=givensRange[0]&&givens<=givensRange[1]){best={grid:g.map(x=>x.slice()),steps:s.steps};}
      if(givens<givensRange[0])break;
    }
    if(best){
      // low: prefer at least a few blanks
      return {type:'latin',diff,grid:best.grid,tr,tc,answer:full[tr][tc],steps:best.steps};
    }
  }
  return genLatin(diff==='high'?'medium':'low');
}

/* ---------- MATHEMATICAL EQUATIONS ---------- */
const VN=['A','B','C','D'];
function eqTemplates(v,names){
  // v: values array, names letters. returns list of {txt, f(vals)=>bool, vars:[idx], single:bool}
  const out=[]; const n=v.length;
  const add=(txt,f,vars)=>out.push({txt,f,vars});
  for(let i=0;i<n;i++){
    const X=names[i],x=v[i];
    const k=RNG.int(2,15);
    add(`${k} + ${X} = ${k+x}`,a=>k+a[i]===k+x,[i]);
    if(x>2) {const m=RNG.int(1,x-1); add(`${X} – ${m} = ${x-m}`,a=>a[i]-m===x-m,[i]);}
    const t=x+RNG.int(1,10); add(`${t} – ${X} = ${t-x}`,a=>t-a[i]===t-x,[i]);
    for(let j=0;j<n;j++){ if(i===j)continue; const Y=names[j],y=v[j];
      if(y>x) add(`${X} + ${y-x} = ${Y}`,a=>a[i]+(y-x)===a[j],[i,j]);
      if(x>y) add(`${X} – ${x-y} = ${Y}`,a=>a[i]-(x-y)===a[j],[i,j]);
      if(y%x===0&&y/x>1) add(`${y/x} × ${X} = ${Y}`,a=>(y/x)*a[i]===a[j],[i,j]);
      if(x%y===0&&x/y>1) add(`${X} ÷ ${x/y} = ${Y}`,a=>a[i]/(x/y)===a[j],[i,j]);
      if(i<j){
        add(`${X} + ${Y} = ${x+y}`,a=>a[i]+a[j]===x+y,[i,j]);
        if(x!==y) add(x>y?`${X} – ${Y} = ${x-y}`:`${Y} – ${X} = ${y-x}`,a=>Math.abs(a[i]-a[j])===Math.abs(x-y)&&(x>y?a[i]>a[j]:a[j]>a[i]),[i,j]);
        add(`${x+y} – ${Y} = ${X}`,a=>(x+y)-a[j]===a[i],[i,j]);
      }
      const m=RNG.int(2,4); const r=m*x-y; if(Math.abs(r)>12){} else if(r>0) add(`${m} × ${X} – ${r} = ${Y}`,a=>m*a[i]-r===a[j],[i,j]); else if(r<0) add(`${m} × ${X} + ${-r} = ${Y}`,a=>m*a[i]-r===a[j],[i,j]);
      for(let k2=0;k2<n;k2++){ if(k2===i||k2===j||j<i)continue; const Z=names[k2],z=v[k2];
        if(x+y===z) add(`${X} + ${Y} = ${Z}`,a=>a[i]+a[j]===a[k2],[i,j,k2]);
        const s=x+y-z; if(s>0) add(`${X} + ${Y} – ${Z} = ${s}`,a=>a[i]+a[j]-a[k2]===s,[i,j,k2]);
        const p=2*x+2*y; if(p===z) add(`2 × ${X} + 2 × ${Y} = ${Z}`,a=>2*a[i]+2*a[j]===a[k2],[i,j,k2]);
        const q=x*y; if(q===z) add(`${X} × ${Y} = ${Z}`,a=>a[i]*a[j]===a[k2],[i,j,k2]);
      }
    }
  }
  if(n===4){
    const s=v[0]-v[1]+v[2]-v[3]; if(s>0) add(`A – B + C – D = ${s}`,a=>a[0]-a[1]+a[2]-a[3]===s,[0,1,2,3]);
    const s2=v[0]+v[1]-v[2]+v[3]; if(s2>0) add(`A + B – C + D = ${s2}`,a=>a[0]+a[1]-a[2]+a[3]===s2,[0,1,2,3]);
    const s3=v[2]+v[3]-v[0]; if(s3>0) add(`C + D – A = ${s3}`,a=>a[2]+a[3]-a[0]===s3,[0,2,3]);
  }
  return out;
}
function countSolutions(eqs,n){
  let cnt=0, sol=null; const a=new Array(n).fill(1);
  const rec=d=>{ if(cnt>1)return; if(d===n){ if(eqs.every(e=>e.f(a))){cnt++;sol=a.slice();} return;}
    for(let x=1;x<=20;x++){a[d]=x;rec(d+1);} };
  rec(0); return {cnt,sol};
}
function genEquations(diff){
  const n={low:2,medium:3,high:4}[diff];
  for(let attempt=0;attempt<500;attempt++){
    const v=Array.from({length:n},()=>RNG.int(1,20)); const names=VN.slice(0,n);
    const T=eqTemplates(v,names);
    const singles=T.filter(t=>t.vars.length===1), multis=T.filter(t=>t.vars.length>1);
    let eqs=[];
    const maxSingles=diff==='low'?1:0;
    const pool=RNG.shuffle(multis);
    if(maxSingles&&Math.random()<0.6) eqs.push(RNG.pick(singles));
    for(const t of pool){ if(eqs.length>=n)break;
      if(diff==='high'&&eqs.length===0&&t.vars.length<3)continue;
      if(eqs.some(e=>e.txt===t.txt))continue; eqs.push(t);}
    if(eqs.length<n)continue;
    // every var appears
    if(!names.every((_,i)=>eqs.some(e=>e.vars.includes(i))))continue;
    if(diff!=='low'&&eqs.filter(e=>e.vars.length===1).length>0)continue;
    const {cnt,sol}=countSolutions(eqs,n);
    if(cnt===1){
      return {type:'eq',diff,eqs:RNG.shuffle(eqs).map(e=>e.txt),names,answer:sol};
    }
  }
  return genEquations(diff);
}

/* ---------- FIGURE SEQUENCES (4x4) ---------- */
const N=4;
const SHAPES=['tri','hex','sq','half','ell','trap','arrow','circ'];
const ORIENTED={tri:true,half:true,ell:true,trap:true,arrow:true,hex:false,sq:false,circ:false};
const COLORS={black:'#1d1d1f',pink:'#d9559c',yellow:'#f2d23c',green:'#1f9e74',orange:'#f08a24',white:'#ffffff',blue:'#2f6fd6'};
const COLN2=Object.keys(COLORS);
const RING=(()=>{const r=[];for(let c=0;c<N;c++)r.push([0,c]);for(let q=1;q<N;q++)r.push([q,N-1]);for(let c=N-2;c>=0;c--)r.push([N-1,c]);for(let q=N-2;q>=1;q--)r.push([q,0]);return r;})(); // clockwise 12
function bounce(len,start,dir,t){ // position along 0..len-1 with reflection
  if(len===1)return 0; const P=2*(len-1); let p=((start*(dir>0?1:-1)+ (dir>0?0:0)));
  // map to unfolded coordinate
  let u = dir>0? start : (P - start)%P; u=(u+t)%P; return u<len? u : P-u;
}
function tri(k){return k*(k+1)/2;} // cumulative for x+1: after t transitions = t(t+1)/2
function makeMover(){
  const kind=RNG.pick(['line','line','diag','ring','ring','cycle']);
  const m={kind};
  if(kind==='line'){m.axis=RNG.pick(['h','v']);m.fixed=RNG.int(0,3);m.start=RNG.int(0,3);m.dir=RNG.pick([1,-1]);m.step=1;
    m.desc=`moves ${m.axis==='h'?'horizontally':'vertically'} one field at a time in ${m.axis==='h'?'row':'column'} ${m.fixed+1} and bounces off the border`;}
  if(kind==='diag'){
    const dr=RNG.pick([1,-1]),dc=RNG.pick([1,-1]);
    // build maximal diagonal segment through random cell
    let r=RNG.int(0,3),c=RNG.int(0,3); while(r-dr>=0&&r-dr<N&&c-dc>=0&&c-dc<N){r-=dr;c-=dc;}
    const seg=[];while(r>=0&&r<N&&c>=0&&c<N){seg.push([r,c]);r+=dr;c+=dc;}
    if(seg.length<3)return makeMover();
    m.seg=seg;m.start=RNG.int(0,seg.length-1);m.dir=RNG.pick([1,-1]);
    const vd=(dr*m.dir>0)?'downwards':'upwards', hd=(dc*m.dir>0)?'right':'left';
    m.desc=`moves diagonally ${vd} to the ${hd} one field at a time, bounces off the border and returns the same way`;
  }
  if(kind==='ring'){m.start=RNG.int(0,11);m.dir=RNG.pick([1,-1]);m.step=RNG.pick([1,1,2,'x+1']);
    m.desc=`moves along the outer border ${m.dir>0?'clockwise':'counter-clockwise'} by ${m.step==='x+1'?'x + 1 fields (1, then 2, then 3 …)':m.step===2?'two fields':'one field'} at a time`;}
  if(kind==='cycle'){const base=[[0,-1,'left'],[-1,0,'up'],[0,1,'right'],[1,0,'down']];const rot=RNG.int(0,3);let seq=base.slice(rot).concat(base.slice(0,rot));if(Math.random()<.5)seq=[seq[0],seq[3],seq[2],seq[1]];
    m.seq=seq;
    // choose start so the 2x2 loop fits
    for(let k=0;k<50;k++){const r=RNG.int(0,3),c=RNG.int(0,3);let rr=r,cc=c,ok=true;for(let t=0;t<6;t++){if(t>0){rr+=seq[(t-1)%4][0];cc+=seq[(t-1)%4][1];}if(rr<0||rr>3||cc<0||cc>3)ok=false;}if(ok){m.r=r;m.c=c;break;}}
    if(m.r===undefined)return makeMover();
    m.desc=`moves one field per image in the repeating order ${seq.map(s=>s[2]).join(', ')}`;}
  return m;
}
function posAt(m,t){
  if(m.kind==='line'){const p=bounce(4,m.start,m.dir,t);return m.axis==='h'?[m.fixed,p]:[p,m.fixed];}
  if(m.kind==='diag'){const p=bounce(m.seg.length,m.start,m.dir,t);return m.seg[p];}
  if(m.kind==='ring'){const d=m.step==='x+1'?tri(t):m.step*t;const i=(((m.start+m.dir*d)%12)+12)%12;return RING[i];}
  if(m.kind==='cycle'){let r=m.r,c=m.c;for(let k=0;k<t;k++){r+=m.seq[k%4][0];c+=m.seq[k%4][1];}return [r,c];}
}
function makeFigure(diff,used){
  const shape=RNG.pick(SHAPES.filter(s=>!used.has(s))); used.add(shape);
  const f={shape,mover:makeMover()};
  const extras=diff==='low'?0:diff==='medium'?RNG.pick([0,1,1]):RNG.pick([1,1,2]);
  const opts=RNG.shuffle(ORIENTED[shape]?['rot','col']:['col']).slice(0,extras);
  f.rot=null; f.cols=null;
  f.baseRot=ORIENTED[shape]?RNG.pick([0,90,180,270]):0;
  if(opts.includes('rot')){f.rot={dir:RNG.pick([1,-1]),mode:diff==='high'&&Math.random()<.4?'x+1':RNG.pick([1,1,2])};}
  const nc=RNG.pick([2,2,3]); const cl=RNG.shuffle(COLN2).slice(0,nc);
  if(opts.includes('col')) f.cols=cl; else f.color=cl[0];
  if(f.rot&&f.rot.mode===2&&!ORIENTED[shape])f.rot=null;
  return f;
}
function stateAt(f,t){
  const [r,c]=posAt(f.mover,t);
  let rot=f.baseRot;
  if(f.rot){const k=f.rot.mode==='x+1'?tri(t):f.rot.mode*t; rot=(((f.baseRot+f.rot.dir*90*k)%360)+360)%360;}
  const color=f.cols?f.cols[t%f.cols.length]:f.color;
  return {shape:f.shape,r,c,rot,color};
}
function figDesc(f){
  const nm={tri:'triangle',hex:'hexagon',sq:'square',half:'half-circle',ell:'L-corner',trap:'arrow-head',arrow:'arrow',circ:'circle'}[f.shape];
  let s=`The ${f.cols?'':f.color+' '}${nm} ${f.mover.desc}`;
  if(f.rot){s+=f.rot.mode==='x+1'?`; it turns 90° ${f.rot.dir>0?'right':'left'} x + 1 times (1×, 2×, 3× …)`:`; it turns ${90*f.rot.mode}° to the ${f.rot.dir>0?'right':'left'} each image`;}
  if(f.cols){s+=`; its colour cycles ${f.cols.join(' → ')}`;}
  return s+'.';
}
const key=fr=>fr.map(s=>`${s.shape}${s.r}${s.c}${s.rot}${s.color}`).sort().join('|');
const valid=fr=>new Set(fr.map(s=>s.r*4+s.c)).size===fr.length;
function mutate(frame,figs,t){
  const out=frame.map(s=>({...s})); const i=RNG.int(0,out.length-1); const s=out[i], f=figs[i];
  const kinds=[];
  kinds.push('pos','pos'); if(ORIENTED[s.shape])kinds.push('rot'); if(f.cols||Math.random()<.3)kinds.push('col');
  const k=RNG.pick(kinds);
  if(k==='pos'){
    const alt=RNG.pick([t-1,t+1,t+2].filter(x=>x>=0)); const [r,c]=posAt(f.mover,alt);
    if(r===s.r&&c===s.c){const d=RNG.pick([[0,1],[1,0],[0,-1],[-1,0]]);s.r=Math.min(3,Math.max(0,s.r+d[0]));s.c=Math.min(3,Math.max(0,s.c+d[1]));}
    else{s.r=r;s.c=c;}
  }
  if(k==='rot'){s.rot=(s.rot+RNG.pick([90,180,270]))%360;}
  if(k==='col'){const pool=f.cols?f.cols:COLN2;s.color=RNG.pick(pool.filter(x=>x!==s.color))||RNG.pick(COLN2.filter(x=>x!==s.color));}
  return out;
}
function genFigures(diff){
  const nf={low:RNG.pick([1,1,2]),medium:RNG.pick([2,3]),high:RNG.pick([3,4])}[diff];
  for(let attempt=0;attempt<300;attempt++){
    const used=new Set(); const figs=Array.from({length:nf},()=>makeFigure(diff,used));
    if(diff==='high'&&!figs.some(f=>f.mover.step==='x+1'||(f.rot&&f.rot.mode==='x+1'))&&Math.random()<.7){const f=figs[0];if(f.mover.kind==='ring')f.mover.step='x+1';else if(ORIENTED[f.shape]){f.rot={dir:1,mode:'x+1'};}}
    if(diff==='high'){for(const f of figs)f.mover.desc=makeDescFix(f.mover);}
    const frames=[0,1,2,3,4,5].map(t=>figs.map(f=>stateAt(f,t)));
    if(!frames.every(valid))continue;
    // frames must differ
    if(new Set(frames.map(key)).size<4)continue;
    const answers=[4,5].map(t=>{
      const correct=frames[t]; const opts=[correct]; const keys=new Set([key(correct)]);
      let g=0; while(opts.length<3&&g<200){g++;const m=mutate(correct,figs,t);if(valid(m)&&!keys.has(key(m))){keys.add(key(m));opts.push(m);}}
      const sh=RNG.shuffle(opts); return {options:sh,correct:sh.indexOf(correct)};
    });
    if(answers.some(a=>a.options.length<3))continue;
    return {type:'fig',diff,frames:frames.slice(0,4),answers,explain:figs.map(figDesc)};
  }
  return genFigures(diff);
}
function makeDescFix(m){ if(m.kind==='ring'){return `moves along the outer border ${m.dir>0?'clockwise':'counter-clockwise'} by ${m.step==='x+1'?'x + 1 fields (1, then 2, then 3 …)':m.step===2?'two fields':'one field'} at a time`;} return m.desc; }

