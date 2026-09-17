/* ===== subject extensions ===== */
const OLD_AREA={stats:'stats',bayes:'stats',regression:'stats',growth:'math',elasticity:'econ',game:'econ',market:'econ',npv:'biz',breakeven:'biz',ohm:'phys',kinematics:'phys',gas:'phys',heat:'phys',ph:'chembio',enzyme:'chembio',bigo:'cs',binary:'cs',survey:'soc'};
PASSAGES.forEach(p=>{p.area=OLD_AREA[p.id];p.qs.forEach(q=>{if(!q.t){const txt=q.q+' '+q.o.join(' ');q.t=/which statement|what does|why|interpret|best explanation|correct\?|requirement|what is true|how is .* interpreted|what happens/i.test(q.q)&&!/\d{2,}/.test(q.o.join(''))?'concept':'calc';}})});
MORE.forEach(p=>PASSAGES.push(p));
PASSAGES.forEach(p=>{PBY[p.id]=p;});
const AREAS={math:'Mathematics',stats:'Statistics & Probability',phys:'Physics & Engineering',chembio:'Chemistry & Biology',econ:'Economics',biz:'Business & Finance',cs:'Computer Science',soc:'Social Sciences & Humanities'};
const QTYPES={calc:'Calculation',data:'Table / chart reading',concept:'Concept check',multi:'Statements I / II / III',except:'EXCEPT / NOT',transfer:'Transfer scenario'};
const TYPE_TIP={calc:'Estimate the order of magnitude before calculating, then eliminate options that are far off.',data:'Find the exact row, column or bar first; most errors come from reading the wrong cell.',concept:'The answer is in the text. Find the sentence that defines the term and match it word for word.',multi:'Judge I, II and III separately. One false statement eliminates every option containing it.',except:'Three options are true. Test each one and pick the one that fails.',transfer:'Change only what the scenario changes, recompute, and keep everything else fixed.'};
const MOCK_OF={};Object.entries(MOCK_SETS).forEach(([k,ids])=>ids.forEach(id=>MOCK_OF[id]=k));
const areaTests=a=>PASSAGES.filter(p=>p.area===a&&!MOCK_OF[p.id]);
const tipOf=it=>it.tip||TYPE_TIP[it.t]||'';

const TRICKS=[
 {g:'Figure Sequences',f:'Three options differ — where do you look first?',b:'Find the one figure whose state differs between the options and solve only that figure.'},
 {g:'Figure Sequences',f:'x + 1 steps: total distance after 1, 2, 3, 4, 5 transitions?',b:'1, 3, 6, 10, 15. Image 5 = image 4 + 4 steps, image 6 = image 5 + 5 steps.'},
 {g:'Figure Sequences',f:'Outer ring of a 4×4 grid: how many fields?',b:'12. Count border walks modulo 12.'},
 {g:'Figure Sequences',f:'Diagonal mover hits a wall — what happens?',b:'It returns along the same diagonal. It never switches to straight movement.'},
 {g:'Figure Sequences',f:'A 4-direction cycle (e.g. left, up, right, down)',b:'After 4 moves it is back at the start, so image 5 has the same position as image 1.'},
 {g:'Figure Sequences',f:'An option shows two figures in one cell',b:'Always wrong. Figures never overlap or disappear.'},
 {g:'Equations',f:'First move on a new system?',b:'Start with an equation that has one unknown or that defines a letter ("5 × B = A").'},
 {g:'Equations',f:'A − (13 − C) = …',b:'A − 13 + C. A minus before a bracket flips every sign.'},
 {g:'Equations',f:'A + B = 24 and A − B = 14',b:'Add them: 2A = 38, so A = 19 and B = 5.'},
 {g:'Equations',f:'B ÷ 2 = A with values 1–20',b:'B is even and at most 20, so A is at most 10. Use the range to prune.'},
 {g:'Equations',f:'Last 5 seconds of every item?',b:'Put your values back into EVERY equation.'},
 {g:'Latin Squares',f:'First 10 seconds?',b:'Read the ? row and column. If four different letters appear there, the fifth letter is the answer.'},
 {g:'Latin Squares',f:'Hidden single',b:'Take a letter missing from a row and ask where it can go. If only one cell survives the column check, place it there.'},
 {g:'Latin Squares',f:'A letter already appears 4 times',b:'Its 5th position is forced: the only row and column it is still missing from.'},
 {g:'Latin Squares',f:'Keeping deductions without notes',b:'Say them silently with coordinates ("β4 is D"). Keep at most 2–3 in your head.'},
 {g:'Subject Module',f:'Order of reading',b:'Read the question first, then scan the text for the formula or definition it needs.'},
 {g:'Subject Module',f:'Options are 1 / 10 / 100 / 1,000',b:'Estimate the order of magnitude and skip the exact calculation.'},
 {g:'Subject Module',f:'"If X doubles, what happens to Y?"',b:'Look at the power of X in the formula: x² → ×4, √x → ×1.41, 1/x → ÷2, 1/√x → ÷1.41.'},
 {g:'Subject Module',f:'Unit traps',b:'°C → K (+273), km/h ÷ 3.6 = m/s, mL → L (÷1,000), kW = kJ per second.'},
 {g:'Subject Module',f:'Option says > 100 % efficiency or a negative count',b:'Physically impossible, so eliminate it immediately.'},
 {g:'Subject Module',f:'"Among those who …" in a question',b:'Conditional question: shrink the denominator to that group.'},
 {g:'Subject Module',f:'Time budget',b:'About 2 minutes per question. Flag the slow ones and come back. Never leave a blank.'},
 ...Object.entries(QTYPES).map(([k,v])=>({g:'Question types',f:v,b:TYPE_TIP[k]})),
 {g:'Mathematics',f:'Infinite geometric sum',b:'First term ÷ (1 − ratio), valid only if |ratio| < 1.'},
 {g:'Mathematics',f:'f′(x) = 0 means…?',b:'A candidate for a maximum or minimum, not a guarantee (x³ at 0 is neither).'},
 {g:'Mathematics',f:'Order matters? Repetition allowed?',b:'Answer both questions, then choose n!, n!/(n−k)!, C(n,k) or n^k.'},
 {g:'Statistics & Probability',f:'68–95–99.7',b:'Share within ±1σ, ±2σ and ±3σ. The share above +2σ is about 2.5 %.'},
 {g:'Statistics & Probability',f:'Adding a constant vs multiplying',b:'Adding a constant moves the mean only. Multiplying by k scales the SD by k and the variance by k².'},
 {g:'Statistics & Probability',f:'Bayes questions',b:'Imagine 10,000 people and count the true and false positives.'},
 {g:'Statistics & Probability',f:'Type I vs Type II',b:'Type I = false alarm (a true H₀ is rejected). Type II = missed effect.'},
 {g:'Physics & Engineering',f:'Energy conservation fall',b:'v = √(2gh). The mass cancels.'},
 {g:'Physics & Engineering',f:'Series vs parallel',b:'In series, resistances add. In parallel, the total is smaller than the smallest resistor.'},
 {g:'Physics & Engineering',f:'Gas laws',b:'Always use kelvin. p·V = const at constant T; V ∝ T at constant p.'},
 {g:'Chemistry & Biology',f:'pH step of 1',b:'A factor of 10 in [H⁺]. A 3-unit difference means 1,000×.'},
 {g:'Chemistry & Biology',f:'Aa × Aa',b:'1 AA : 2 Aa : 1 aa. Among the dominant offspring, 2/3 are Aa.'},
 {g:'Chemistry & Biology',f:'Stoichiometry chain',b:'Mass → moles → coefficient ratio → moles → mass.'},
 {g:'Economics',f:'|E| > 1',b:'Elastic: a price rise lowers revenue.'},
 {g:'Economics',f:'Real vs nominal',b:'Real = nominal ÷ (CPI/100). Real growth ≈ nominal growth − inflation.'},
 {g:'Economics',f:'Comparative advantage',b:'Compare opportunity costs, not hours. Mutually beneficial terms lie between the two opportunity costs.'},
 {g:'Business & Finance',f:'Break-even',b:'Fixed costs ÷ (price − variable cost).'},
 {g:'Business & Finance',f:'NPV & rates',b:'A higher discount rate gives a lower NPV. At NPV = 0 the rate equals the IRR.'},
 {g:'Business & Finance',f:'Critical path',b:'The longest path. A delay beyond an activity\'s slack extends the project by (delay − slack).'},
 {g:'Computer Science',f:'Binary search on 1,024 items',b:'About 10 comparisons (2¹⁰ = 1,024).'},
 {g:'Computer Science',f:'INNER vs LEFT JOIN',b:'LEFT JOIN = the inner-join rows plus the unmatched left rows.'},
 {g:'Computer Science',f:'Dijkstra requirement',b:'All edge weights must be non-negative.'},
 {g:'Social Sciences & Humanities',f:'Halve the margin of error',b:'Take a 4× larger sample.'},
 {g:'Social Sciences & Humanities',f:'Valid vs sound',b:'Valid = the structure holds. Sound = valid AND the premises are true.'},
 {g:'Social Sciences & Humanities',f:'Absolute majority',b:'More than 50 %. A plurality is simply the most votes.'},
 {g:'Economics',f:'Policy rate goes up',b:'Borrowing gets dearer, so investment and demand fall and inflation eases with a lag. The currency tends to strengthen and bond prices fall.'},
 {g:'Business & Finance',f:'CLV with churn',b:'Lifetime = 1 ÷ churn; CLV = yearly profit × lifetime. Healthy if CLV ≥ 3 × CAC.'},
 {g:'Social Sciences & Humanities',f:'Primary vs secondary source',b:'Primary = made at the time under study. Secondary = later interpretation. Corroborate only with independent sources.'},
 {g:'Chemistry & Biology',f:'Logistic growth',b:'r·N·(1 − N/K): fastest at K/2, zero at K, negative above K.'},
 {g:'Exam habits',f:'Before you answer a Latin square',b:'Check the ? row and column first. About a third of items are solved right there.'},
 {g:'Exam habits',f:'One minute left in a section',b:'Stop solving and put a guess on every blank item.'},
];
