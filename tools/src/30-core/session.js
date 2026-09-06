/* ══════════════════════════════════════════════════════════════════
   §5 세션
   원본 intern_sim_v25.html 에서 그대로 옮겨 왔다. 내용 변경 없음.
   ══════════════════════════════════════════════════════════════════ */
const rank = t => TIER.indexOf(t);

/* 예산 = 낮은 레벨은 표준턴 전액, 그 위는 ⌈표준턴 × BUDGET_CUT⌉ */
function budgetOf(list, std=STD){
  return list.reduce((s,id)=>{
    const lv = P.SCRIPT[id].lv;
    return s + (lv<=BUDGET_FULL_LV ? std[lv] : Math.ceil(std[lv]*BUDGET_CUT));
  },0);
}

/* ── 조기 정산 ──────────────────────────────────────────────
   턴 시작 시점에만 가능. 그 시점의 판 상태로 5단계가 결정된다. */
//@ 세션.정산 — 언제 손을 떼는가
function settle(S, core){ return K.outcome(S, core) }

/* AI의 정산 판단.
   allowance = 남은 예산 ÷ 남은 환자. 이 이상 쓰고 있고,
   지금 끊어도 목표 등급 이상이면 끊는다. */
function shouldSettle(S, core, spent, allowance, aim){
  const now = settle(S, core);
  if(now==='완치') return true;                       // 더 얻을 것이 없다
  if(S.hp<=0) return true;
  if(rank(now) >= rank(aim)) return true;             // 목표에 닿았으면 턴을 아낀다
  if(spent >= allowance) return true;                 // 배정을 다 썼으면 있는 대로 끊는다
  return false;
}

/* ── 환자 한 명 ── */
//@ 세션.러너 — 화면 없이 한 판 · 한 세션 돌리기
function runOne(board, deck, seed, opt={}){
  const S = K.newState(board, opt); S.board = board;
  C.setupDeck(S, deck, K.mulberry32(seed));
  const core = board.core;
  const hard = opt.hardCap || TURN_HARD_CAP;
  let t = 0;
  while(t < hard){
    if(S.hp<=0) break;
    if(!K.alive(S).length) break;
    /* 턴 시작 — 정산 판단 */
    if(t>0 && opt.settleAt && opt.settleAt(S, core, t)) break;
    t++;
    (opt.ai==='H' ? H.aiTurn : D.aiTurn)(S, opt);
    if(!K.alive(S).length) break;
    C.endTurnHand(S); K.turnResolve(S);
  }
  return {out: settle(S, core), turns: t, S};
}

/* ── 외래 세션 ──────────────────────────────────────────────
   턴 예산을 다 쓰면 남은 환자는 '악화'로 자동 정산된다. */
function runSession(list, deck, budget, seed, opt={}){
  const aim = opt.aim || '호전';
  let left = budget, i = 0;
  const out = [];
  for(const id of list){
    const remain = list.length - i;
    if(left <= 0){ out.push({id, out:'악화', turns:0, auto:true}); i++; continue }
    const allowance = Math.max(1, Math.floor(left / remain));
    const board = P.makePatient(id, seed + i*97);
    const r = runOne(board, deck, seed + i*97 + 5,
      {...opt, hardCap: Math.min(left, opt.hardCap||TURN_HARD_CAP),
       settleAt:(S,core,t)=>shouldSettle(S,core,t,allowance,aim)});
    left -= r.turns;
    out.push({id, out:r.out, turns:r.turns, hp:r.S.hp/r.S.hpMax});
    i++;
  }
  return {rows:out, used:budget-left, left, budget};
}

/* ── 왕진 ───────────────────────────────────────────────────
   포스터 6팀 중 둘을 고른다. 완충 = 1포스터에 3명, 그 밖 = 1명.
   라운드마다 덱을 다시 짠다. 턴 예산 대신 라운드가 경계다.

   전용 러너(runRound)는 v25 에서 걷어냈다 — 부르는 곳이 한 곳도 없었다.
   왕진 배치는 SESSIONS.d3 의 rounds 를 펼친 list 를 runSession 에 넘겨 돈다. */
