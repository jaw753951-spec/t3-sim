/* ══════════════════════════════════════════════════════════════════
   §8 빔 탐색 (기본)
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
/* ── 상태 복제 ── 탐색 중에는 난수를 고정해 갈래가 흔들리지 않게 한다 */
//@ AI.평가 — 판 복제 · 판 점수
function clone(S){
  const nodes = S.nodes.map(n=>({...n}));
  const T = {...S,
    nodes,
    hand:S.hand.slice(), deck:S.deck.slice(), discard:S.discard.slice(), exiled:S.exiled.slice(),
    keepUses:{...S.keepUses}, oncePlayed:{...(S.oncePlayed||{})}, hitThisTurn:{...S.hitThisTurn},
    rng: ()=>0.5, rec: null, revisitOn: {...(S.revisitOn||{})}, diagPlus: {...(S.diagPlus||{})},
    drawQueue: (S.drawQueue||[]).slice(),
    pendKill: (S.pendKill||[]).slice(), killLate: [],
    board: {...S.board, nodes},
    _log: (S._log||[]).slice(),
  };
  return T;
}

/* ── 평가 ── 이 판에서 좋은 상태란 무엇인가 */
function evalState(S){
  const W = AIW;
  let v = 0;
  for(const n of S.nodes){
    if(n.dead){ v += W.dead; continue }                   // 뽑은 자리 — 되살아나지 않는다
    if(n.val<=0){ v += W.dorm; continue }                 // 재운 자리 — 2턴 뒤 돌아온다
    const line = K.killLine(S,n);
    const rest = n.val - line;
    if(rest<=0) v += W.ready - rest*0.1;                  // 뽑을 수 있는 상태 = 거의 뽑은 것
    else v -= rest*W.rest;                                // 아직 남은 일
    v -= K.turnDmg(n)*W.atk;                                        // 이 자리는 계속 때린다
    v -= K.growAmt(S,n)*W.grow;
    if(!n.evolved && n.evoLeft<=1) v -= (R.EVO_HIT[n.sym]||0)*W.evo;
    if(n.shielded) v -= W.shield;
    if(C.rigTotal(n)>0) v += C.rigTotal(n)*W.rig;
  }
  v += (S.pendKill||[]).length * W.dead * 0.8;   // 미뤄 둔 처치도 거의 뽑은 것으로 본다
  v += (S.hp/S.hpMax)*W.hp;
  v -= (S.mind==='불안'?W.anx : S.mind==='공황'?W.panic : S.mind==='의식불명'?W.panic*R.MIND_KO_W : 0);
  v += S.energy*W.energy + S.hand.length*W.hand;
  return v;
}

/* ── 이번 턴에 둘 수 있는 수 ── */
//@ AI.수 — 이번 턴에 둘 수 있는 수
function moves(S){
  const out = [];
  const live = K.alive(S).filter(n=>n.val>0);
  /* 처치 — 광역 억제가 큰 것부터 */
  for(const n of K.alive(S))
    if(K.canKill(S,n) && S.energy>=R.KILL_COST && !S.rem)
      out.push({t:'kill', i:S.nodes.indexOf(n), s:K.sweepAmt(n)});
  /* 카드 */
  const seen = {};
  for(const id of S.hand){
    if(seen[id]) continue; seen[id]=true;
    if(!C.canPlay(S,id)) continue;
    const c = C.CARDS[id];
    if(c.target==='node'){
      let tg = live.slice().sort((a,b)=>b.val-a.val).slice(0,AIW.targets);
      /* 재진 없이 못 여는 자리, 설치물이 없는 자리, 1막 병 노드는 후보에서 뺀다 */
      if(c.verb==='진단') tg = tg.filter(n=>K.canDiag(S,n,C.hasRevisit(S,id)));
      if(c.kw==='개방')  tg = live.filter(n=>n.rig>0);
      if(c.verb!=='진단') tg = tg.filter(n=>!K.immune(S,n));
      if(c.need && c.need.length<2) tg = tg.filter(n=>c.need(n));
      for(const n of tg) out.push({t:'card', id, i:S.nodes.indexOf(n)});
      /* 안정화·완화는 막이 있는 자리에도 따로 */
      if(c.sub==='안정화'||c.sub==='완화')
        for(const n of live) if(!tg.includes(n)) out.push({t:'card', id, i:S.nodes.indexOf(n)});
    } else if(c.target==='hand'){
      /* 손패를 대상으로 잡는다 */
      const pool = C.handPicks(S,id), want = C.pickNeed(S,id);
      if(!want) continue;
      if(want===1){
        for(const x of [...new Set(pool)]) out.push({t:'card', id, i:-1, arg:[x]});
      } else {
        /* 여러 장은 조합이 커진다 — 값이 싼 쪽부터 정해진 수만큼 버린다 */
        const cheap = pool.slice().sort((a,b)=>
          (C.CARDS[a].v.sup||0)/Math.max(1,C.cardCost(S,a)) - (C.CARDS[b].v.sup||0)/Math.max(1,C.cardCost(S,b)));
        out.push({t:'card', id, i:-1, arg:cheap.slice(0,want)});
      }
    } else out.push({t:'card', id, i:-1});
  }
  return out;
}

function apply(S, m){
  if(m.t==='kill') return K.doKill(S, S.nodes[m.i]);
  return C.play(S, m.id, m.i>=0 ? S.nodes[m.i] : null, m.arg);
}

/* ── 빔 탐색 ── */
//@ AI.탐색 — 빔 탐색 · 한 턴 · 한 판
function planTurn(S){
  const BEAM=AIW.beam, DEPTH=AIW.depth;
  let beam = [{S:clone(S), seq:[], v:evalState(S)}];
  let best = beam[0];
  for(let d=0; d<DEPTH; d++){
    const next = [];
    for(const b of beam){
      if(b.S.played >= R.PLAY_CAP) continue;
      for(const m of moves(b.S)){
        const T = clone(b.S);
        if(!apply(T, m)) continue;
        const v = evalState(T);
        next.push({S:T, seq:[...b.seq, m], v});
      }
    }
    if(!next.length) break;
    next.sort((a,b)=>b.v-a.v);
    beam = next.slice(0, BEAM);
    if(beam[0].v > best.v) best = beam[0];
  }
  return best.seq;
}

/* 계획은 clone 위에서 짜이고, clone 의 난수는 ()=>0.5 로 고정되어 있다 —
   탐색이 흔들리지 않게 하려는 선택이다. 그런데 계획 안에 뽑기가 끼면 그 고정이
   대가를 부른다: 클론이 뽑은 카드와 실제 판이 뽑은 카드가 다르다. 덱이 비어
   재셔플까지 걸리면 아예 딴 손이 된다. 그 뒤의 수는 손에 없는 카드를 가리킨다.

   그래서 덱이 움직인 순간 나머지 계획을 버리고 다시 짠다. 사람도 뽑고 나면
   손을 다시 보고 정한다 — 옛 휴리스틱(aiTurnH)은 처음부터 그렇게 하고 있었고,
   그쪽에서는 이 일이 나지 않았다.

   「뽑기 카드」가 아니라 「덱이 움직였는가」로 보는 이유는, 덱을 건드리는 손이
   앞으로 늘어도 규칙이 그대로 맞기 때문이다. */
//@ AI.한턴 — 계획을 얹되, 덱이 움직이면 다시 짠다
function aiTurn(S, opt={}){
  S.played = 0;
  for(let round=0; round<=R.PLAY_CAP; round++){
    const seq = planTurn(S);
    if(!seq.length) return;
    let deckMoved = false;
    for(const m of seq){
      if(S.played >= R.PLAY_CAP) return;
      const deck0 = S.deck.length, sh0 = S.shuffles||0;
      if(!apply(S, m)) break;                 // 낼 수 없는 수가 나오면 거기서 계획을 접는다
      if(S.deck.length !== deck0 || (S.shuffles||0) !== sh0){ deckMoved = true; break }
    }
    if(!deckMoved) return;
  }
}

/* ── 한 판 ── */
function runDeck(board, deck, seed, opt={}){
  const S = K.newState(board, opt); S.board = board;
  C.setupDeck(S, deck, K.mulberry32(seed));
  const CAP = opt.turnCap || 40;
  for(let t=1;t<=CAP;t++){
    if(S.hp<=0 && !board.noDeath) return {out:'사망', turns:t, S};
    if(!K.alive(S).length) return {out:S.evoLog?'호전':'완치', turns:t, S};
    if(opt.settleAt && t>1 && opt.settleAt(S, board.core, t-1)) break;
    (opt.ai==='H' ? H.aiTurn : aiTurn)(S, opt);
    if(!K.alive(S).length) return {out:S.evoLog?'호전':'완치', turns:t, S};
    C.endTurnHand(S); K.turnResolve(S);
  }
  return {out:K.outcome(S, board.core), turns:CAP, S};
}
