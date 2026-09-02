/* ══════════════════════════════════════════════════════════════════
   §2 레벨 생성기
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
const tagGroupOf = t => TAG_GROUP.find(g=>g.includes(t)) || null;

/* t 를 켰을 때의 최종 목록 — 같은 묶음의 것을 밀어내고 상한을 넘으면 가장 오래된 것을 뺀다 */
function tagAdd(list, t){
  const g = tagGroupOf(t);
  let out = list.filter(x=>x!==t && !(g && g.includes(x)));
  out.push(t);
  while(out.length > TAG_CAP) out.shift();
  return out;
}

/* ── S 산식 (§5) ─────────────────────────────────────────── */
//@ 생성기.S산식 — 판 하나를 난이도 숫자 하나로 옮긴다
/* S 산식 한 벌. 실제 판(S_of)과 레벨표 중앙값 검산(medianBoards)이
   같은 식을 쓴다 — 갈라져 있으면 검산이 검산 구실을 못 한다 */
function sFormula({n, valSum, basic, enh, evo, atkW, shN}){
  const shTerm = shN===0 ? 0 : (shN===n ? SW.shAll : SW.shSome);
  return SW.node*n + valSum/SW.valDiv + SW.basic*basic + SW.enh*enh
       + (SW.evoRef-evo) + SW.atk*atkW + shTerm;
}
function S_of(board){
  const ns = board.nodes;
  return sFormula({
    n:      ns.length,
    valSum: ns.reduce((s,n)=>s+n.init,0),
    basic:  basicLines(ns.map(n=>n.sym)).length,
    enh:    board.enh.length,
    evo:    board.evoBase,                             // 레벨 기준값. 증상 보정 전
    atkW:   ns.reduce((s,n)=>s+(ATK_W[n.sym]||0),0),
    shN:    ns.filter(n=>n.shielded).length,
  });
}

function lv_of(S){ const c=SW.lvCut; return S<=c[0]?1 : S<=c[1]?2 : S<=c[2]?3 : S<=c[3]?4 : 5 }

/* ── 판 생성 ────────────────────────────────────────────────
   opt.tags   : 체력 태그 배열
   opt.syms   : 증상을 지정 (대본 환자 이식용). 개수는 레벨표를 따르지 않는다
   opt.strict : true 면 S 판정이 주문 레벨과 어긋난 판을 버리고 다시 뽑는다 */
//@ 생성기.판생성 — 증상 뽑기 · 판 조립
function pickSyms(rng, cnt, atkCap, wantBasic, force, atkTarget){
  if(force) return force.slice(0,cnt);
  const pool2=[]; let best=null, bestGap=1e9;
  for(let t=0;t<600;t++){
    const pool=[...ALLSYM], chosen=[]; let atk=0;
    while(chosen.length<cnt && pool.length){
      const s = pool.splice(Math.floor(rng()*pool.length),1)[0];
      if(SYM[s].atk && atk>=atkCap) continue;
      if(SYM[s].atk) atk++;
      chosen.push(s);
    }
    if(chosen.length<cnt) continue;
    const b = basicLines(chosen).length;
    if(b<wantBasic[0] || b>wantBasic[1]) continue;
    if(atkTarget==null) return chosen;
    const w = chosen.reduce((s,x)=>s+(ATK_W[x]||0),0);
    const gap = Math.abs(w-atkTarget);
    /* 목표는 평균이지 매 판의 값이 아니다 — ±1 을 허용해야 판이 다양해진다.
       엄격히 맞추면 Lv3이 전부 출혈 판이 되어 증상 구성이 하나로 굳는다. */
    if(gap<=1) pool2.push(chosen);
    if(gap<bestGap){ bestGap=gap; best=chosen }
    if(pool2.length>=12) break;
  }
  if(pool2.length) return pool2[Math.floor(rng()*pool2.length)];
  return best;
}

function build(level, rng, opt={}){
  const T = LVTAB[level];
  const cnt  = opt.syms ? opt.syms.length : T.n[0]+Math.floor(rng()*(T.n[1]-T.n[0]+1));
  const syms = pickSyms(rng, cnt, T.atkCap, T.basic, opt.syms, opt.atkFree?null:ATK_TARGET[level]);
  if(!syms) return null;

  const mainN = Math.min(cnt, 1+Math.floor(rng()*MAIN_MAX));   // 주 밴드에서 1~MAIN_MAX 개
  const nodes = syms.map((s,i)=>{
    const band = (i<mainN || !T.sub) ? T.main : T.sub;
    const init = BAND[band] + Math.floor(rng()*INIT_SPREAD);
    const evo  = Math.max(1, T.evo + (EVO_ADJ[s]||0));
    const shielded = T.shield==='all' || (T.shield==='one' && i===0);
    return {sym:s, init, val:init, band, shielded, shReduc:shielded?R.SHIELD_CUT:0, stabAcc:0,
            grow:0, evo, evoLeft:evo, evolved:false, dead:false, dormT:0, weak:0,
            rig:0, rigUp:0, rigCap:0, rigLent:0, delayed:0,
            diagRound:0, diagAcc:0, diagNeed:R.DIAG_NEED, demoted:false,
            revealed:false, spawned:false, role:'sym'};
  });
  if(!nodes.some(n=>SYM[n.sym].atk)) for(const n of nodes) n.grow += R.NOATK_G;

  /* 강화형 — 상한 둘을 함께 지킨다 (§2 각주)
     강화형 ≤ 노드수−2 · 기본형+강화형 ≤ 노드수+2 */
  const basic = basicLines(syms).length;
  const capA  = Math.max(0, nodes.length-2);
  const capB  = Math.max(0, nodes.length+2-basic);
  const want  = T.enh[0]+Math.floor(rng()*(T.enh[1]-T.enh[0]+1));
  const enhN  = Math.min(want, capA, capB);
  const enh=[];
  for(let g=0; g<200 && enh.length<enhN; g++){
    const a=nodes[Math.floor(rng()*nodes.length)].sym, b=nodes[Math.floor(rng()*nodes.length)].sym;
    if(a===b) continue;
    if(enh.some(e=>e.a===a&&e.b===b)) continue;
    enh.push({a,b,k:['가속','경화','점화'][Math.floor(rng()*3)],kind:'trig',hidden:true});
  }

  const hp = hpOfTags(opt.tags||[]);   // v26 — 레벨표가 아니라 체격표를 본다
  const board = {nodes, enh, hp, hpMax:hp, level, evoBase:T.evo,
                 tags:opt.tags||[], core: opt.core || nodes[0].sym};
  board.S = S_of(board);
  board.lvCalc = lv_of(board.S);
  return board;
}

function makeBoard(level, rng, opt={}){
  for(let t=0;t<60;t++){
    const b = build(level, rng, opt);
    if(!b) continue;
    if(!opt.strict || b.lvCalc===level) return b;
  }
  return build(level, rng, opt);
}

/* ── 레벨표 중앙값으로 S 검산 (§5 자체 검증) ── */
//@ 생성기.검산 — 레벨표 중앙값으로 S 자체 검산
function medianBoards(){
  const out={};
  for(const lv of [1,2,3,4,5]){
    const T=LVTAB[lv];
    const cnt = Math.round((T.n[0]+T.n[1])/2);
    const mainN = Math.min(cnt,1);
    // 중앙값 = 밴드값 + 폭의 한가운데. 공격 노드는 상한의 절반을 발열로 잡는다
    const atkN = Math.floor(T.atkCap/2) || 1;
    const nodes=[];
    for(let i=0;i<cnt;i++){
      const band=(i<mainN||!T.sub)?T.main:T.sub;
      nodes.push({sym: i<atkN?'발열':'통증', init: BAND[band]+INIT_MID,
                  shielded: T.shield==='all'||(T.shield==='one'&&i===0)});
    }
    out[lv]= sFormula({
      n:      cnt,
      valSum: nodes.reduce((s,n)=>s+n.init,0),
      basic:  Math.round((T.basic[0]+T.basic[1])/2),
      enh:    Math.round((T.enh[0]+T.enh[1])/2),
      evo:    T.evo,
      atkW:   nodes.reduce((s,n)=>s+(ATK_W[n.sym]||0),0),
      shN:    nodes.filter(n=>n.shielded).length,
    });
  }
  return out;
}
